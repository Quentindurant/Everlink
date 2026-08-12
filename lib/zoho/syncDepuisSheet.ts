// Synchronisation Zoho Sheet → app : les champs de planification tenus par les ADV dans le
// TABLEAU SUIVI COMMANDES redescendent sur les dossiers rapprochés. Les noms ne sont jamais
// modifiés, ni côté Sheet ni côté app (voir lib/domain/zoho/rapprochement).
// Un champ vide côté Sheet ne touche jamais la valeur de l'app.
import { prisma } from "@/lib/prisma";
import { normaliserNomTech } from "@/lib/domain/technicien/disponibilite";
import { lireLignesSheet } from "@/lib/zoho/zohoClient";
import {
  parseDateSheet,
  rapprocherLignes,
} from "@/lib/domain/zoho/rapprochement";

export interface ZohoPullResultat {
  succes: boolean;
  onglet: string;
  lignesSheet: number;
  rapproches: number;
  misAJour: number;
  // Techniciens du Sheet ajoutés à l'annuaire lors de ce passage.
  techniciensCrees?: number;
  lignesInconnues: string[];
  message?: string;
}

export async function runZohoPull(): Promise<ZohoPullResultat> {
  const { onglet, lignes } = await lireLignesSheet();
  if (lignes.length === 0) {
    return {
      succes: false,
      onglet,
      lignesSheet: 0,
      rapproches: 0,
      misAJour: 0,
      lignesInconnues: [],
      message: "Aucune ligne EVERLINK lue dans le Sheet (Zoho indisponible ou onglet vide).",
    };
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

  const { apparies, lignesInconnues } = rapprocherLignes(lignes, clients);
  const parId = new Map(clients.map((c) => [c.id, c]));

  // Le Sheet fait foi pour les affectations : un technicien qu'il cite mais que l'annuaire
  // ignore est créé, sinon l'affectation ne remonterait jamais dans l'app. La comparaison
  // ignore casse et accents — le Sheet contient « Bruce », « BRUCE » et « bruce » pour la
  // même personne, et des cases de service (« / », « - ») qui ne sont pas des noms.
  let techniciensCrees = 0;
  const estNomPlausible = (t: string) => t.length >= 2 && /\p{L}{2,}/u.test(t);

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
    const data: Record<string, unknown> = {};

    if (c.zohoNomSheet !== a.nomSheet) data.zohoNomSheet = a.nomSheet;

    const statut = a.ligne.installation.trim().toUpperCase();
    if (statut && statut !== (c.statutSuivi ?? "")) data.statutSuivi = statut;

    const date = parseDateSheet(a.ligne.date);
    if (date && date.getTime() !== (c.dateIntervention?.getTime() ?? 0)) data.dateIntervention = date;

    const heure = a.ligne.heure.trim();
    if (heure && heure !== (c.creneauIntervention ?? "")) data.creneauIntervention = heure;

    const techId = await techParNom(a.ligne.nomTech);
    if (techId && techId !== c.technicienId) data.technicienId = techId;

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
