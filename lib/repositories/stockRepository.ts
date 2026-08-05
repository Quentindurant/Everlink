import { prisma } from "@/lib/prisma";
import {
  LIBELLE_STATUT,
  STATUTS_STOCK,
  type ArticleStockLigne,
} from "@/lib/domain/stock/statuts";

export type { ArticleStockLigne } from "@/lib/domain/stock/statuts";
export { LIBELLE_STATUT, STATUT_SUIVANT, STATUTS_STOCK } from "@/lib/domain/stock/statuts";

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function fetchArticlesStock(filtre: {
  type?: string;
  statut?: string;
}): Promise<ArticleStockLigne[]> {
  const articles = await prisma.articleStock.findMany({
    where: {
      archiveA: null,
      ...(filtre.type ? { type: filtre.type } : {}),
      ...(filtre.statut ? { statut: filtre.statut } : {}),
    },
    include: { client: { select: { raisonSociale: true } } },
    orderBy: [{ type: "asc" }, { numeroSerie: "asc" }],
  });
  return articles.map((a) => ({
    id: a.id,
    type: a.type,
    numeroSerie: a.numeroSerie,
    statut: a.statut,
    origine: a.origine,
    etatAppareil: a.etatAppareil,
    clientFinal: a.client?.raisonSociale ?? a.clientFinalTexte,
    dateReception: jour(a.dateReception),
    dateEnvoi: jour(a.dateEnvoi),
    commentaire: a.commentaire,
  }));
}

export interface AInstallerLigne {
  id: string;
  type: string;
  numeroSerie: string;
  statut: string;
  clientId: string | null;
  clientNom: string;
  lienStatut: string | null; // "Non commandé" | "Commandé" | "Livré" | null (non rattaché)
  dateIntervention: string | null;
  technicienNom: string | null;
}

// Matériel envoyé/configuré en attente d'installation. Quand l'article est rattaché à une fiche
// client, on remonte l'état du lien et l'intervention pour tout voir au même endroit.
export async function fetchAInstaller(): Promise<AInstallerLigne[]> {
  const articles = await prisma.articleStock.findMany({
    where: { archiveA: null, statut: { in: ["CONFIGURE", "ENVOYE"] } },
    include: {
      client: {
        select: {
          raisonSociale: true,
          lienCommande: true,
          lienLivre: true,
          dateIntervention: true,
          technicien: { select: { nom: true } },
        },
      },
    },
    orderBy: [{ statut: "asc" }, { type: "asc" }],
  });
  return articles.map((a) => {
    const c = a.client;
    const lienStatut = c ? (c.lienLivre ? "Livré" : c.lienCommande ? "Commandé" : "Non commandé") : null;
    return {
      id: a.id,
      type: a.type,
      numeroSerie: a.numeroSerie,
      statut: a.statut,
      clientId: a.clientId,
      clientNom: c?.raisonSociale ?? a.clientFinalTexte ?? "—",
      lienStatut,
      dateIntervention: c?.dateIntervention ? jour(c.dateIntervention) : null,
      technicienNom: c?.technicien?.nom ?? null,
    };
  });
}

export async function listClientsPourStock(): Promise<{ id: string; raisonSociale: string }[]> {
  return prisma.client.findMany({
    where: { archiveA: null },
    select: { id: true, raisonSociale: true },
    orderBy: { raisonSociale: "asc" },
  });
}

export interface StatsStock {
  parStatut: { statut: string; libelle: string; count: number }[];
  types: string[];
}

export async function statsStock(): Promise<StatsStock> {
  const [groupes, types] = await Promise.all([
    prisma.articleStock.groupBy({
      by: ["statut"],
      where: { archiveA: null },
      _count: { _all: true },
    }),
    prisma.articleStock.findMany({
      where: { archiveA: null },
      distinct: ["type"],
      select: { type: true },
      orderBy: { type: "asc" },
    }),
  ]);
  const map = new Map(groupes.map((g) => [g.statut, g._count._all]));
  return {
    parStatut: STATUTS_STOCK.map((s) => ({
      statut: s,
      libelle: LIBELLE_STATUT[s],
      count: map.get(s) ?? 0,
    })),
    types: types.map((t) => t.type),
  };
}
