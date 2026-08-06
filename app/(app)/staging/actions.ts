"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  importStock,
  parseStockWorkbook,
  previewStock,
  type ArticleStockRow,
  type ImportStockResultat,
  type StockPreviewRow,
} from "@/lib/repositories/importStockRepository";
import { STATUT_SUIVANT } from "@/lib/repositories/stockRepository";
import { numeroSuiviValide } from "@/lib/domain/tracking/laposte";
import { suivreColis } from "@/lib/tracking/laPosteClient";

async function garde() {
  const session = await auth();
  return !!session?.user;
}

export async function previsualiserStockAction(
  formData: FormData
): Promise<
  { success: true; rows: StockPreviewRow[]; ignores: number } | { success: false; error: string }
> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const { rows, ignores } = await parseStockWorkbook(buffer);
  if (rows.length === 0) return { success: false, error: "Aucun article détecté dans le fichier." };
  return { success: true, rows: await previewStock(rows), ignores };
}

export async function validerStockAction(
  rows: ArticleStockRow[]
): Promise<{ success: true; resultat: ImportStockResultat } | { success: false; error: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importStock(rows);
    revalidatePath("/staging", "layout");
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}

// Fait avancer un article dans le cycle En stock → Configuré → Envoyé → Installé, en horodatant
// l'envoi et l'installation au passage.
export async function avancerStatutAction(id: string): Promise<void> {
  if (!(await garde())) return;
  const article = await prisma.articleStock.findUnique({ where: { id }, select: { statut: true } });
  if (!article) return;
  const suivant = STATUT_SUIVANT[article.statut];
  if (!suivant) return;
  await prisma.articleStock.update({
    where: { id },
    data: {
      statut: suivant,
      ...(suivant === "ENVOYE" ? { dateEnvoi: new Date() } : {}),
      ...(suivant === "INSTALLE" ? { dateInstallation: new Date() } : {}),
    },
  });
  revalidatePath("/staging", "layout");
}

// Expédie un article : le passe en « Envoyé », enregistre le transporteur (défaut Chronopost)
// et le numéro de suivi, puis tente un premier relevé d'état (le cron rafraîchira ensuite).
export async function expedierAvecSuiviAction(
  id: string,
  transporteur: string,
  numeroSuivi: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const num = numeroSuivi.trim();
  if (num && !numeroSuiviValide(num)) {
    return { success: false, error: "Numéro de suivi invalide (11 à 15 caractères)." };
  }
  const etat = num ? await suivreColis(num) : null;
  await prisma.articleStock.update({
    where: { id },
    data: {
      statut: "ENVOYE",
      dateEnvoi: new Date(),
      transporteur: transporteur.trim() || "Chronopost",
      numeroSuivi: num || null,
      suiviStatut: etat?.statut ?? null,
      suiviLibelle: etat?.libelle ?? null,
      suiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: num ? new Date() : null,
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Expédie un lot d'articles dans un même colis : tous passent en « Envoyé » avec le même
// transporteur, numéro de suivi et client destinataire. Un premier état de suivi est relevé.
export async function expedierLotAction(
  ids: string[],
  transporteur: string,
  numeroSuivi: string,
  clientNom: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  if (ids.length === 0) return { success: false, error: "Aucun article sélectionné." };
  const num = numeroSuivi.trim();
  if (num && !numeroSuiviValide(num)) {
    return { success: false, error: "Numéro de suivi invalide (11 à 15 caractères)." };
  }
  const nom = clientNom.trim();
  const client = nom
    ? await prisma.client.findFirst({
        where: { archiveA: null, raisonSociale: { equals: nom, mode: "insensitive" } },
        select: { id: true },
      })
    : null;
  const etat = num ? await suivreColis(num) : null;
  await prisma.articleStock.updateMany({
    where: { id: { in: ids } },
    data: {
      statut: "ENVOYE",
      dateEnvoi: new Date(),
      transporteur: transporteur.trim() || "Chronopost",
      numeroSuivi: num || null,
      clientId: client?.id ?? null,
      clientFinalTexte: nom || null,
      suiviStatut: etat?.statut ?? null,
      suiviLibelle: etat?.libelle ?? null,
      suiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: num ? new Date() : null,
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Rattache un article à un client. Si le nom correspond exactement à une fiche client active,
// on stocke l'ID (ce qui débloque les liens/intervention dans « À installer »); sinon on garde
// juste le texte libre.
export async function rattacherClientAction(id: string, nom: string): Promise<void> {
  if (!(await garde())) return;
  const t = nom.trim();
  if (!t) {
    await prisma.articleStock.update({ where: { id }, data: { clientId: null, clientFinalTexte: null } });
    revalidatePath("/staging", "layout");
    return;
  }
  const client = await prisma.client.findFirst({
    where: { archiveA: null, raisonSociale: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  await prisma.articleStock.update({
    where: { id },
    data: client
      ? { clientId: client.id, clientFinalTexte: t }
      : { clientId: null, clientFinalTexte: t },
  });
  revalidatePath("/staging", "layout");
}

// Ajoute un article saisi à la main (ou à la douchette) : entre en stock daté du jour.
// Un article actif portant le même numéro de série est refusé (pas de doublon silencieux).
export async function ajouterArticleAction(
  type: string,
  numeroSerie: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const serie = numeroSerie.trim();
  if (!serie) return { success: false, error: "Numéro de série requis." };
  const existant = await prisma.articleStock.findFirst({
    where: { archiveA: null, numeroSerie: { equals: serie, mode: "insensitive" } },
    select: { statut: true },
  });
  if (existant) {
    return { success: false, error: `${serie} déjà présent (${existant.statut}).` };
  }
  await prisma.articleStock.create({
    data: {
      type: type.trim() || "Routeur 4G seul",
      numeroSerie: serie,
      statut: "EN_STOCK",
      dateReception: new Date(),
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Édite un champ d'un article (type, numéro de série ou commentaire).
export async function updateArticleAction(
  id: string,
  champ: "type" | "numeroSerie" | "commentaire",
  valeur: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const v = valeur.trim();
  if (champ !== "commentaire" && !v) return { success: false, error: "Valeur requise." };
  await prisma.articleStock.update({
    where: { id },
    data: { [champ]: champ === "commentaire" ? v || null : v },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Enregistre le routeur récupéré chez le client le jour de l'installation (origine CLIENT).
export async function ajouterRetourAction(
  type: string,
  numeroSerie: string,
  clientFinal: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  if (!numeroSerie.trim()) return { success: false, error: "Numéro de série requis." };
  await prisma.articleStock.create({
    data: {
      type: type.trim() || "Routeur client",
      numeroSerie: numeroSerie.trim(),
      statut: "RETOUR",
      origine: "CLIENT",
      clientFinalTexte: clientFinal.trim() || null,
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function supprimerArticleAction(id: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.articleStock.update({ where: { id }, data: { archiveA: new Date() } });
  revalidatePath("/staging", "layout");
}
