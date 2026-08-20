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
import { rapprocherLignes } from "@/lib/domain/zoho/rapprochement";
import {
  champsAMettreAJour,
  estLigneEverlink,
  libelleMoisSuivi,
  ligneDepuisRow,
  moisCourant,
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
  const mois = moisCourant();
  const onglet = libelleMoisSuivi(mois);

  if (!suiviConfig().configure) {
    return echec(onglet, "Tableau de suivi non configuré (variables SUIVI_API_* manquantes).");
  }

  let lignes;
  try {
    const rows = await suiviClient().lireLignesMois(mois);
    lignes = rows.filter((r) => !r.archived && estLigneEverlink(r.data)).map((r) => ligneDepuisRow(r.data));
  } catch (e) {
    return echec(onglet, e instanceof Error ? e.message : "Tableau de suivi injoignable.");
  }
  if (lignes.length === 0) {
    return echec(onglet, "Aucune ligne EVERLINK lue dans le tableau de suivi pour ce mois.");
  }

  const [clients, techniciens] = await Promise.all([
    prisma.client.findMany({
      where: { archiveA: null },
      select: {
        id: true,
        raisonSociale: true,
        zohoNomSheet: true,
        statutSuivi: true,
        dateIntervention: true,
        creneauIntervention: true,
        technicienId: true,
      },
    }),
    prisma.technicien.findMany({ where: { actif: true }, select: { id: true, nom: true } }),
  ]);

  // Référentiel commun : les techniciens ajoutés côté tableau (Paramètres → listes,
  // choix de la colonne nom_tech) redescendent dans l'annuaire, même sans dossier
  // affecté ce mois-ci. Mêmes règles que la création automatique ci-dessous : nom
  // plausible, pas de doublon (casse/espaces/accents), prestataire inconnu. Un
  // référentiel illisible laisse le pull classique inchangé (liste vide).
  let techniciensCrees = 0;
  const labelsReferentiel = await lireLabelsReferentiel(suiviClient());
  for (const nom of techniciensManquantsDuReferentiel(labelsReferentiel, techniciens.map((t) => t.nom))) {
    const cree = await prisma.technicien.create({ data: { nom, departements: [] } });
    techniciens.push({ id: cree.id, nom: cree.nom });
    techniciensCrees++;
  }

  const { apparies, lignesInconnues } = rapprocherLignes(lignes, clients);
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
