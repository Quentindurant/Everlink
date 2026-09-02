// Accès base pour la reprise des ONT. Les règles vivent dans lib/domain/staging/ont.ts ;
// ici on ne fait que lire, écrire, et appliquer leur verdict.

import { prisma } from "@/lib/prisma";
import { peutEntrerDansLot, valideClotureLot } from "@/lib/domain/staging/ont";

export interface OntLigne {
  id: string;
  numeroSerie: string;
  client: string | null;
  saisiLe: string;
  dateReception: string | null;
}

export interface LotOnt {
  id: string;
  destinataire: string;
  transporteur: string | null;
  numeroSuivi: string | null;
  expedieLe: string | null;
  suiviStatut: string | null;
  suiviLibelle: string | null;
  suiviEtape: number | null;
  suiviLivreLe: string | null;
  articles: OntLigne[];
}

const jour = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

const SELECT_ONT = {
  id: true,
  numeroSerie: true,
  creeLe: true,
  dateReception: true,
  clientFinalTexte: true,
  client: { select: { raisonSociale: true } },
} as const;

interface LigneBrute {
  id: string;
  numeroSerie: string;
  creeLe: Date;
  dateReception: Date | null;
  clientFinalTexte: string | null;
  client: { raisonSociale: string } | null;
}

function versLigne(a: LigneBrute): OntLigne {
  return {
    id: a.id,
    numeroSerie: a.numeroSerie,
    client: a.client?.raisonSociale ?? a.clientFinalTexte,
    saisiLe: a.creeLe.toISOString().slice(0, 10),
    dateReception: jour(a.dateReception),
  };
}

function versLot(lot: {
  id: string;
  destinataire: string;
  transporteur: string | null;
  numeroSuivi: string | null;
  expedieLe: Date | null;
  suiviStatut: string | null;
  suiviLibelle: string | null;
  suiviEtape: number | null;
  suiviLivreLe: Date | null;
  articles: LigneBrute[];
}): LotOnt {
  return {
    id: lot.id,
    destinataire: lot.destinataire,
    transporteur: lot.transporteur,
    numeroSuivi: lot.numeroSuivi,
    expedieLe: jour(lot.expedieLe),
    suiviStatut: lot.suiviStatut,
    suiviLibelle: lot.suiviLibelle,
    suiviEtape: lot.suiviEtape,
    suiviLivreLe: jour(lot.suiviLivreLe),
    articles: lot.articles.map(versLigne),
  };
}

// Saisis par un chef de projet mais pas encore dans un lot : ceux du haut ne sont même pas
// arrivés physiquement, et c'est là qu'un appareil se perd.
export async function fetchOntsAnnonces(): Promise<OntLigne[]> {
  const articles = await prisma.articleStock.findMany({
    where: { type: "ONT", archiveA: null, lotRetourId: null },
    select: SELECT_ONT,
    orderBy: [{ dateReception: "asc" }, { creeLe: "asc" }],
  });
  return articles.map(versLigne);
}

// Le panier courant du staging : un seul lot ouvert à la fois.
export async function fetchLotOuvert(): Promise<LotOnt | null> {
  const lot = await prisma.lotRetourOnt.findFirst({
    where: { expedieLe: null },
    orderBy: { creeLe: "desc" },
    include: { articles: { select: SELECT_ONT } },
  });
  return lot ? versLot(lot) : null;
}

export async function fetchLotsPartis(): Promise<LotOnt[]> {
  const lots = await prisma.lotRetourOnt.findMany({
    where: { expedieLe: { not: null } },
    orderBy: { expedieLe: "desc" },
    include: { articles: { select: SELECT_ONT } },
  });
  return lots.map(versLot);
}

export async function cocherReceptionOnt(id: string, recu: boolean): Promise<void> {
  await prisma.articleStock.update({
    where: { id },
    data: { dateReception: recu ? new Date() : null },
  });
}

export async function verserDansLot(articleId: string): Promise<{ ok: boolean; message?: string }> {
  const article = await prisma.articleStock.findUnique({
    where: { id: articleId },
    select: { dateReception: true, lotRetourId: true },
  });
  if (!article) return { ok: false, message: "ONT introuvable." };
  if (!peutEntrerDansLot(article)) {
    return { ok: false, message: "Cochez d'abord la réception de cet ONT." };
  }

  // Le lot ouvert se crée à la volée : le staging n'a pas à l'ouvrir explicitement avant de
  // poser son premier appareil dedans.
  const ouvert =
    (await prisma.lotRetourOnt.findFirst({ where: { expedieLe: null }, select: { id: true } })) ??
    (await prisma.lotRetourOnt.create({ data: { destinataire: "" }, select: { id: true } }));

  await prisma.articleStock.update({
    where: { id: articleId },
    data: { lotRetourId: ouvert.id },
  });
  return { ok: true };
}

export async function retirerDuLot(articleId: string): Promise<void> {
  await prisma.articleStock.update({ where: { id: articleId }, data: { lotRetourId: null } });
}

export async function cloreLot(champs: {
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): Promise<{ ok: true; lotId: string } | { ok: false; message: string }> {
  const lot = await prisma.lotRetourOnt.findFirst({
    where: { expedieLe: null },
    orderBy: { creeLe: "desc" },
    select: { id: true, _count: { select: { articles: true } } },
  });
  if (!lot) return { ok: false, message: "Aucun lot en préparation." };

  const verdict = valideClotureLot({ nbArticles: lot._count.articles, ...champs });
  if (!verdict.ok) return { ok: false, message: verdict.message };

  // Le départ du lot et le passage de ses ONT en ENVOYE sont indissociables : un lot parti
  // dont les appareils seraient restés « en stock » les rendrait éligibles à un second lot.
  await prisma.$transaction([
    prisma.lotRetourOnt.update({
      where: { id: lot.id },
      data: {
        destinataire: champs.destinataire.trim(),
        transporteur: champs.transporteur.trim(),
        numeroSuivi: champs.numeroSuivi.trim(),
        expedieLe: new Date(),
      },
    }),
    prisma.articleStock.updateMany({
      where: { lotRetourId: lot.id },
      data: { statut: "ENVOYE", dateEnvoi: new Date() },
    }),
  ]);
  return { ok: true, lotId: lot.id };
}
