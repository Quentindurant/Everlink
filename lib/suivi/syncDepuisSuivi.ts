// Synchronisation tableau de suivi → app (remplace runZohoPull) : les champs de
// planification tenus par les ADV dans le tableau maison (https://suivie.appgcd.fr)
// redescendent sur les dossiers rapprochés. Les noms ne sont jamais modifiés, ni côté
// tableau ni côté app (voir lib/domain/zoho/rapprochement, réutilisé tel quel).
// Un champ vide côté tableau ne touche jamais la valeur de l'app
// (voir champsAMettreAJour, lib/domain/suivi/ligneSuivi).
import { prisma } from "@/lib/prisma";
import {
  estNomPlausible,
  techniciensManquantsDuReferentiel,
} from "@/lib/domain/suivi/referentielTechniciens";
import { normaliserNomTech } from "@/lib/domain/technicien/disponibilite";
import { cleComparaison, rapprocherLignes } from "@/lib/domain/zoho/rapprochement";
import {
  champsAMettreAJour,
  codePartenaireLigne,
  libelleMoisSuivi,
  ligneDepuisRow,
  moisAsynchroniser,
} from "@/lib/domain/suivi/ligneSuivi";
import { lireLabelsReferentiel } from "./referentielTechniciens";
import { suiviClient, suiviConfig } from "./suiviClient";

/** Même forme que l'ancien ZohoPullResultat : l'UI (ZohoLiveView) le consomme tel quel. */
export interface SuiviPullResultat {
  succes: boolean;
  /** Libellé du mois synchronisé, ex "AOUT 2026" (ex-onglet du classeur). */
  onglet: string;
  lignesSheet: number;
  rapproches: number;
  misAJour: number;
  // Techniciens du tableau ajoutés à l'annuaire lors de ce passage.
  techniciensCrees?: number;
  lignesInconnues: string[];
  message?: string;
}

function echec(onglet: string, message: string): SuiviPullResultat {
  return {
    succes: false,
    onglet,
    lignesSheet: 0,
    rapproches: 0,
    misAJour: 0,
    lignesInconnues: [],
    message,
  };
}

export async function runSuiviPull(): Promise<SuiviPullResultat> {
  const mois = moisAsynchroniser();
  const onglet = mois.map(libelleMoisSuivi).join(", ");


  // code du partenaire → identifiant, pour ranger chaque ligne du tableau de son côté.
  const partenaires = await prisma.partenaire.findMany({
    where: { actif: true },
    select: { id: true, code: true },
  });
  const idParCode = new Map(partenaires.map((p) => [p.code, p.id]));

  if (!suiviConfig().configure) {
    return echec(onglet, "Tableau de suivi non configuré (variables SUIVI_API_* manquantes).");
  }

  // Plusieurs mois, du plus ancien au plus récent : un dossier planifié en août n'a plus de
  // ligne en septembre, et sans cette fenêtre son statut ne bougeait plus jamais. Un même
  // client présent dans deux mois garde la ligne la plus récente, écrite en dernier.
  const parClient = new Map<string, ReturnType<typeof ligneDepuisRow> & { codePartenaire: string }>();
  const moisLus: string[] = [];
  let derniereErreur: string | null = null;
  for (const m of mois) {
    // Chaque mois est lu indépendamment : un onglet qui n'existe pas encore — le mois
    // prochain, en début de période — ne doit pas empêcher les autres de se synchroniser.
    let rows;
    try {
      rows = await suiviClient().lireLignesMois(m);
    } catch (e) {
      derniereErreur = e instanceof Error ? e.message : "Tableau de suivi injoignable.";
      continue;
    }
    moisLus.push(m);
    for (const r of rows) {
      if (r.archived) continue;
      const code = codePartenaireLigne(r.data);
      // Toutes les lignes rattachées à un partenaire connu, pas seulement EVERLINK : le
      // cron n'a pas de partenaire actif, il couvre les deux périmètres en un passage.
      if (!idParCode.has(code)) continue;
      const ligne = { ...ligneDepuisRow(r.data), codePartenaire: code };
      if (!ligne.client.trim()) continue;
      // Dédoublonnage sur le nom comparé, pas sur le libellé : le même dossier s'écrit
      // « S31- ARDI SAS » un mois et « ARDI SAS » le suivant. Sans ça chaque dossier
      // apparaissait deux fois, et deux candidats identiques faisaient renoncer le
      // rapprochement par mots au lieu de trancher.
      parClient.set(`${code}|${cleComparaison(ligne.client)}`, ligne);
    }
  }
  if (moisLus.length === 0) {
    return echec(onglet, derniereErreur ?? "Tableau de suivi injoignable.");
  }
  const lignes = [...parClient.values()];
  if (lignes.length === 0) {
    return echec(onglet, "Aucune ligne rattachée à un partenaire connu sur la période lue.");
  }

  const [clients, techniciens] = await Promise.all([
    prisma.client.findMany({
      where: { archiveA: null },
      select: {
        id: true,
        raisonSociale: true,
        zohoNomSheet: true,
        departement: true,
        statutSuivi: true,
        dateIntervention: true,
        creneauIntervention: true,
        technicienId: true,
        chefProjetNom: true,
        partenaireId: true,
      },
    }),
    // L'annuaire complet, désactivés compris : la déduplication du référentiel et le
    // rapprochement doivent les connaître, sinon un technicien désactivé encore
    // présent dans la colonne nom_tech serait recréé actif à chaque pull — annulant
    // la décision admin. Un dossier qui le cite lui est rattaché tel quel : la
    // réactivation reste un geste d'admin, jamais un effet de bord du cron.
    prisma.technicien.findMany({ select: { id: true, nom: true } }),
  ]);
  const nomsConnus = techniciens.map((t) => t.nom);

  // Référentiel commun : les techniciens ajoutés côté tableau (Paramètres → listes,
  // choix de la colonne nom_tech) redescendent dans l'annuaire, même sans dossier
  // affecté ce mois-ci. Mêmes règles que la création automatique ci-dessous : nom
  // plausible, pas de doublon (casse/espaces/accents), prestataire inconnu. Un
  // référentiel illisible laisse le pull classique inchangé (liste vide).
  let techniciensCrees = 0;
  const labelsReferentiel = await lireLabelsReferentiel(suiviClient());
  for (const nom of techniciensManquantsDuReferentiel(labelsReferentiel, nomsConnus)) {
    const cree = await prisma.technicien.create({ data: { nom, departements: [] } });
    techniciens.push({ id: cree.id, nom: cree.nom });
    techniciensCrees++;
  }

  // Appariement cloisonné : deux partenaires peuvent avoir des clients aux noms voisins, et
  // une ligne de l'un ne doit jamais capturer le dossier de l'autre.
  const apparies: ReturnType<typeof rapprocherLignes>["apparies"] = [];
  const lignesInconnues: string[] = [];
  for (const [code, partenaireId] of idParCode) {
    const lignesDuPartenaire = lignes.filter((l) => l.codePartenaire === code);
    if (lignesDuPartenaire.length === 0) continue;
    const clientsDuPartenaire = clients.filter((c) => c.partenaireId === partenaireId);
    const r = rapprocherLignes(lignesDuPartenaire, clientsDuPartenaire);
    apparies.push(...r.apparies);
    lignesInconnues.push(...r.lignesInconnues);
  }
  const parId = new Map(clients.map((c) => [c.id, c]));

  // Le tableau fait foi pour les affectations : un technicien qu'il cite mais que
  // l'annuaire ignore est créé, sinon l'affectation ne remonterait jamais dans l'app.
  // La comparaison ignore casse et accents — le tableau contient « Bruce », « BRUCE » et
  // « bruce » pour la même personne, et des cases de service (« / », « - ») qui ne sont
  // pas des noms (estNomPlausible, règle partagée avec le référentiel).

  const techParNom = async (nom: string): Promise<string | null> => {
    const t = nom.trim();
    if (!t) return null;
    const n = normaliserNomTech(t);
    const exacts = techniciens.filter((x) => normaliserNomTech(x.nom) === n);
    if (exacts.length === 1) return exacts[0].id;
    const prefixes = techniciens.filter((x) => {
      const xn = normaliserNomTech(x.nom);
      return xn.startsWith(n) || n.startsWith(xn);
    });
    if (prefixes.length === 1) return prefixes[0].id;
    // Plusieurs candidats : ambigu, on laisse l'ADV trancher plutôt que de créer un doublon.
    if (prefixes.length > 1) return null;
    // Case de service ou saisie parasite : surtout ne pas la transformer en technicien.
    if (!estNomPlausible(t)) return null;
    const cree = await prisma.technicien.create({ data: { nom: t, departements: [] } });
    techniciens.push({ id: cree.id, nom: cree.nom });
    techniciensCrees++;
    return cree.id;
  };

  let misAJour = 0;
  for (const a of apparies) {
    const c = parId.get(a.clientId);
    if (!c) continue;
    const techId = await techParNom(a.ligne.nomTech);
    const data = champsAMettreAJour(c, a.ligne, a.nomSheet, techId);
    if (Object.keys(data).length === 0) continue;
    await prisma.client.update({ where: { id: a.clientId }, data });
    misAJour++;
  }

  return {
    succes: true,
    onglet,
    lignesSheet: lignes.length,
    rapproches: apparies.length,
    misAJour,
    techniciensCrees,
    lignesInconnues,
  };
}
