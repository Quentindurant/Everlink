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
    transporteur: a.transporteur,
    numeroSuivi: a.numeroSuivi,
    suiviStatut: a.suiviStatut,
    suiviLibelle: a.suiviLibelle,
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

// Matériel présent physiquement au staging (pas encore expédié) : le périmètre du CRUD
// de la page Réception. Les retours clients en font partie.
export async function fetchStockActif(): Promise<ArticleStockLigne[]> {
  return fetchArticlesParStatuts(["EN_STOCK", "CONFIGURE", "RETOUR"]);
}

async function fetchArticlesParStatuts(statuts: string[]): Promise<ArticleStockLigne[]> {
  const articles = await prisma.articleStock.findMany({
    where: { archiveA: null, statut: { in: statuts } },
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
    transporteur: a.transporteur,
    numeroSuivi: a.numeroSuivi,
    suiviStatut: a.suiviStatut,
    suiviLibelle: a.suiviLibelle,
  }));
}

// Articles disponibles à l'expédition : en stock ou configurés, non archivés, non retour.
export async function fetchAExpedier(): Promise<ArticleStockLigne[]> {
  return fetchArticlesParStatuts(["EN_STOCK", "CONFIGURE"]);
}

// Un colis expédié = un groupe d'articles partageant le même numéro de suivi (ou un article
// envoyé sans numéro). Sert à l'historique des expéditions, façon HighStock.
export interface ColisExpedie {
  cle: string; // numeroSuivi, ou id de l'article si pas de suivi
  transporteur: string | null;
  numeroSuivi: string | null;
  suiviStatut: string | null;
  suiviLibelle: string | null;
  suiviEtape: number | null;
  suiviLivreLe: string | null;
  clientFinal: string | null;
  dateEnvoi: string | null;
  articles: { id: string; type: string; numeroSerie: string; statut: string }[];
}

export async function fetchHistoriqueColis(): Promise<ColisExpedie[]> {
  const articles = await prisma.articleStock.findMany({
    where: { archiveA: null, statut: { in: ["ENVOYE", "INSTALLE"] } },
    include: { client: { select: { raisonSociale: true } } },
    orderBy: [{ dateEnvoi: "desc" }, { creeLe: "desc" }],
  });

  const parCle = new Map<string, ColisExpedie>();
  for (const a of articles) {
    const cle = a.numeroSuivi ?? `nolabel-${a.id}`;
    const colis = parCle.get(cle);
    const ligne = { id: a.id, type: a.type, numeroSerie: a.numeroSerie, statut: a.statut };
    if (colis) {
      colis.articles.push(ligne);
    } else {
      parCle.set(cle, {
        cle,
        transporteur: a.transporteur,
        numeroSuivi: a.numeroSuivi,
        suiviStatut: a.suiviStatut,
        suiviLibelle: a.suiviLibelle,
        suiviEtape: a.suiviEtape,
        suiviLivreLe: jour(a.suiviLivreLe),
        clientFinal: a.client?.raisonSociale ?? a.clientFinalTexte,
        dateEnvoi: jour(a.dateEnvoi),
        articles: [ligne],
      });
    }
  }
  return [...parCle.values()];
}

// Dossier de préparation d'un client au staging : son matériel à expédier, sa config
// routeur, sa date d'intervention. Le staging travaille par client, pas par article isolé.
export interface DossierStaging {
  clientId: string | null; // null = articles rattachés par texte libre uniquement
  clientNom: string;
  dateInterventionIso: string | null;
  scenario: string | null;
  aConfigRouteur: boolean;
  articles: ArticleStockLigne[];
}

export interface PreparationStaging {
  dossiers: DossierStaging[];
  nonRattaches: ArticleStockLigne[];
  // Clients avec intervention à venir et scénario routeur, sans aucun matériel rattaché.
  aPreparer: { clientId: string; clientNom: string; dateInterventionIso: string | null; scenario: string | null }[];
}

export async function fetchPreparationStaging(): Promise<PreparationStaging> {
  const [articles, configs, clientsLien] = await Promise.all([
    fetchArticlesParStatuts(["EN_STOCK", "CONFIGURE"]),
    prisma.configRouteur.findMany({ select: { clientId: true, clientTexte: true } }),
    prisma.client.findMany({
      where: {
        archiveA: null,
        dateIntervention: { gte: new Date(new Date().toDateString()) },
        scenario: { contains: "lien", mode: "insensitive" },
      },
      select: { id: true, raisonSociale: true, dateIntervention: true, scenario: true },
      orderBy: { dateIntervention: "asc" },
    }),
  ]);

  // Détails clients des articles rattachés (date d'intervention, scénario).
  const nomsRattaches = [...new Set(articles.map((a) => a.clientFinal).filter(Boolean))] as string[];
  const clientsRattaches = nomsRattaches.length
    ? await prisma.client.findMany({
        where: { archiveA: null, raisonSociale: { in: nomsRattaches } },
        select: { id: true, raisonSociale: true, dateIntervention: true, scenario: true },
      })
    : [];
  const parNom = new Map(clientsRattaches.map((c) => [c.raisonSociale, c]));
  const configsParClient = new Set(configs.map((c) => c.clientId).filter(Boolean));
  const configsParTexte = new Set(configs.map((c) => c.clientTexte).filter(Boolean));

  const parClient = new Map<string, DossierStaging>();
  const nonRattaches: ArticleStockLigne[] = [];
  for (const a of articles) {
    if (!a.clientFinal) {
      nonRattaches.push(a);
      continue;
    }
    const dossier = parClient.get(a.clientFinal);
    if (dossier) {
      dossier.articles.push(a);
    } else {
      const client = parNom.get(a.clientFinal);
      parClient.set(a.clientFinal, {
        clientId: client?.id ?? null,
        clientNom: a.clientFinal,
        dateInterventionIso: client?.dateIntervention?.toISOString().slice(0, 10) ?? null,
        scenario: client?.scenario ?? null,
        aConfigRouteur:
          (client && configsParClient.has(client.id)) || configsParTexte.has(a.clientFinal),
        articles: [a],
      });
    }
  }

  const dossiers = [...parClient.values()].sort((a, b) =>
    (a.dateInterventionIso ?? "9999").localeCompare(b.dateInterventionIso ?? "9999")
  );

  const nomsAvecMateriel = new Set(parClient.keys());
  const aPreparer = clientsLien
    .filter((c) => !nomsAvecMateriel.has(c.raisonSociale))
    .slice(0, 12)
    .map((c) => ({
      clientId: c.id,
      clientNom: c.raisonSociale,
      dateInterventionIso: c.dateIntervention?.toISOString().slice(0, 10) ?? null,
      scenario: c.scenario,
    }));

  return { dossiers, nonRattaches, aPreparer };
}

// Configurations routeur importées (.rsc Sewan), pour l'écran Configuration du staging.
export interface ConfigRouteurLigne {
  id: string;
  clientNom: string | null;
  nomFichier: string;
  donnees: unknown; // ConfigRouteurExtraite (lib/domain/routeur/mikrotik)
  creeLe: string; // ISO
}

export async function fetchConfigsRouteur(): Promise<ConfigRouteurLigne[]> {
  const configs = await prisma.configRouteur.findMany({
    include: { client: { select: { raisonSociale: true } } },
    orderBy: { creeLe: "desc" },
  });
  return configs.map((c) => ({
    id: c.id,
    clientNom: c.client?.raisonSociale ?? c.clientTexte,
    nomFichier: c.nomFichier,
    donnees: c.donnees,
    creeLe: c.creeLe.toISOString(),
  }));
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
