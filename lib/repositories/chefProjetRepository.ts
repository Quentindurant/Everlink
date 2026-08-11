import { prisma } from "@/lib/prisma";
import { estEtapeResolue } from "@/lib/domain/telephone/statuts";

// Checklist de préparation d'un dossier, au niveau client : ce que le chef de projet doit
// avoir bouclé avant et pendant l'intervention. Un dossier clos disparaît de la liste
// active (comme au provisionning) mais reste consultable.

export interface EtapeProjetLite {
  id: string;
  libelle: string;
  phase: string;
  aide: string | null;
}

export interface DossierProjet {
  clientId: string;
  raisonSociale: string;
  dateInterventionIso: string | null;
  creneau: string | null;
  scenario: string | null;
  technicienNom: string | null;
  attribueA: string | null;
  closLe: string | null;
  // etapeId -> { statut, commentaire }
  suivis: Record<string, { statut: string; commentaire: string | null }>;
  nbResolues: number;
  pourcentage: number;
}

export interface ChefProjetVue {
  etapes: EtapeProjetLite[];
  phases: string[];
  dossiers: DossierProjet[];
  valeursStatut: string[];
  nbClos: number;
}

export async function fetchChefProjet(
  filtres: { recherche?: string; avecClos?: boolean } = {}
): Promise<ChefProjetVue> {
  const [etapes, valeurs, clients, nbClos] = await Promise.all([
    prisma.etapeProjet.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } }),
    prisma.listeValeur.findMany({
      where: { categorie: "STATUT_ETAPE", actif: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.client.findMany({
      where: {
        archiveA: null,
        ...(filtres.avecClos ? {} : { projetClosLe: null }),
        ...(filtres.recherche
          ? { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        raisonSociale: true,
        dateIntervention: true,
        creneauIntervention: true,
        scenario: true,
        projetAttribueA: true,
        projetClosLe: true,
        technicien: { select: { nom: true } },
        suivisProjet: {
          where: { etape: { actif: true } },
          select: { etapeId: true, statut: true, commentaire: true },
        },
      },
      // Interventions les plus proches d'abord, comme le provisionning.
      orderBy: [
        { dateIntervention: { sort: "asc", nulls: "last" } },
        { raisonSociale: "asc" },
      ],
    }),
    prisma.client.count({ where: { archiveA: null, projetClosLe: { not: null } } }),
  ]);

  const dossiers = clients.map((c) => {
    const suivis = Object.fromEntries(
      c.suivisProjet.map((s) => [s.etapeId, { statut: s.statut, commentaire: s.commentaire }])
    );
    const nbResolues = etapes.filter((e) => estEtapeResolue(suivis[e.id]?.statut)).length;
    return {
      clientId: c.id,
      raisonSociale: c.raisonSociale,
      dateInterventionIso: c.dateIntervention?.toISOString().slice(0, 10) ?? null,
      creneau: c.creneauIntervention,
      scenario: c.scenario,
      technicienNom: c.technicien?.nom ?? null,
      attribueA: c.projetAttribueA,
      closLe: c.projetClosLe?.toISOString().slice(0, 10) ?? null,
      suivis,
      nbResolues,
      pourcentage: etapes.length > 0 ? Math.round((nbResolues / etapes.length) * 100) : 0,
    };
  });

  return {
    etapes: etapes.map((e) => ({ id: e.id, libelle: e.libelle, phase: e.phase, aide: e.aide })),
    phases: [...new Set(etapes.map((e) => e.phase))],
    dossiers,
    valeursStatut: valeurs.map((v) => v.valeur),
    nbClos,
  };
}

export async function setSuiviProjet(
  clientId: string,
  etapeId: string,
  statut: string,
  auteur: string | null
): Promise<void> {
  const fait = statut === "Fait";
  await prisma.suiviProjet.upsert({
    where: { clientId_etapeId: { clientId, etapeId } },
    update: { statut, faitLe: fait ? new Date() : null, faitPar: fait ? auteur : null },
    create: {
      clientId,
      etapeId,
      statut,
      faitLe: fait ? new Date() : null,
      faitPar: fait ? auteur : null,
    },
  });
}

export async function setCommentaireProjet(
  clientId: string,
  etapeId: string,
  commentaire: string
): Promise<void> {
  const valeur = commentaire.trim() || null;
  await prisma.suiviProjet.upsert({
    where: { clientId_etapeId: { clientId, etapeId } },
    update: { commentaire: valeur },
    create: { clientId, etapeId, commentaire: valeur },
  });
}
