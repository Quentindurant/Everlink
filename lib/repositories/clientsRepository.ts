import { prisma } from "@/lib/prisma";

export interface ClientListeLigne {
  id: string;
  raisonSociale: string;
  lotNom: string | null;
  groupe: string | null;
  filiale: string | null;
  nbNumeros: number;
  // Deux comptes distincts (SPEC §3.2): le Sheet compte les MAC par ligne, donc une MAC
  // partagée est comptée deux fois. On affiche les deux, l'export n'utilise jamais le premier.
  nbMacSaisis: number;
  nbMacDistincts: number;
  nbBasculesFaites: number;
  statutGlobal: string;
  scenario: string | null;
  adresse: string | null;
  contact: string | null;
  nbPostesAnnonce: number | null;
  // Écart entre postes annoncés par Monday et équipements réellement saisis.
  ecartPostes: number | null;
  // Étape du parcours de migration (null si non renseignée).
  etape: { id: string; libelle: string; couleur: string } | null;
}

export interface ClientsListeFiltres {
  lotId?: string;
  recherche?: string;
  etapeMigrationId?: string;
}

export async function fetchClientsListe(
  filtres: ClientsListeFiltres = {}
): Promise<ClientListeLigne[]> {
  const clients = await prisma.client.findMany({
    where: {
      archiveA: null,
      ...(filtres.lotId ? { lotId: filtres.lotId } : {}),
      ...(filtres.etapeMigrationId ? { etapeMigrationId: filtres.etapeMigrationId } : {}),
      ...(filtres.recherche
        ? {
            OR: [
              { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } },
              { groupe: { contains: filtres.recherche, mode: "insensitive" } },
              { filiale: { contains: filtres.recherche, mode: "insensitive" } },
              { adresse: { contains: filtres.recherche, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      lot: true,
      etapeMigration: { select: { id: true, libelle: true, couleur: true } },
      numeros: { where: { archiveA: null }, select: { statutBascule: true } },
      equipements: { where: { archiveA: null }, select: { macNormalise: true } },
    },
    orderBy: { raisonSociale: "asc" },
  });

  return clients.map((c) => ({
    id: c.id,
    raisonSociale: c.raisonSociale,
    lotNom: c.lot?.nom ?? null,
    groupe: c.groupe,
    filiale: c.filiale,
    nbNumeros: c.numeros.length,
    nbMacSaisis: c.equipements.length,
    nbMacDistincts: new Set(c.equipements.map((e) => e.macNormalise)).size,
    nbBasculesFaites: c.numeros.filter((n) => n.statutBascule === "Fait").length,
    statutGlobal: c.statutBascule,
    scenario: c.scenario,
    adresse: c.adresse,
    contact:
      [c.contactPrenom, c.contactNom].filter(Boolean).join(" ") || null,
    nbPostesAnnonce: c.nbPostesAnnonce,
    ecartPostes:
      c.nbPostesAnnonce === null ? null : c.nbPostesAnnonce - c.equipements.length,
    etape: c.etapeMigration
      ? { id: c.etapeMigration.id, libelle: c.etapeMigration.libelle, couleur: c.etapeMigration.couleur }
      : null,
  }));
}

export async function fetchClientDetail(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      lot: true,
      etapeMigration: true,
      numeros: {
        where: { archiveA: null },
        include: { utilisateur: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      },
      equipements: {
        where: { archiveA: null },
        include: { modele: true, utilisateur: true },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      },
      utilisateurs: {
        where: { archiveA: null },
        include: {
          suivis: { where: { etape: { actif: true } }, include: { etape: true } },
        },
        orderBy: [{ ordre: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!client) return null;

  const [etapes, auditLogs] = await Promise.all([
    prisma.etapeModele.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entite: "Client", entiteId: id },
          { entiteId: { in: client.numeros.map((n) => n.id) } },
          { entiteId: { in: client.equipements.map((e) => e.id) } },
          { entiteId: { in: client.utilisateurs.map((u) => u.id) } },
        ],
      },
      include: { auteur: { select: { email: true } } },
      orderBy: { creeLe: "desc" },
      take: 50,
    }),
  ]);

  return { client, etapes, auditLogs };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof fetchClientDetail>>>;
