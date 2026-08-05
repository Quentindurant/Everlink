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
    revalidatePath("/staging");
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
  revalidatePath("/staging");
}

export async function definirClientFinalAction(id: string, texte: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.articleStock.update({
    where: { id },
    data: { clientFinalTexte: texte.trim() || null },
  });
  revalidatePath("/staging");
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
  revalidatePath("/staging");
  return { success: true };
}

export async function supprimerArticleAction(id: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.articleStock.update({ where: { id }, data: { archiveA: new Date() } });
  revalidatePath("/staging");
}
