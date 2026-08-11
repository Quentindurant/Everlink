"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import {
  parseMondayWorkbook,
  rapprocher,
  type MondayLigne,
  type RapprochementResultat,
} from "@/lib/domain/import/monday";
import {
  appliquerImport,
  type ApplicationResultat,
} from "@/lib/repositories/importMondayRepository";
import { prisma } from "@/lib/prisma";

export interface PrevisualisationPayload {
  nomFichier: string;
  tailleOctets: number;
  resultat: RapprochementResultat;
  erreurs: string[];
}

async function exigerAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id as string };
}

export async function previsualiserAction(
  formData: FormData
): Promise<{ success: true; payload: PrevisualisationPayload } | { success: false; error: string }> {
  const admin = await exigerAdmin();
  if (!admin) return { success: false, error: "Réservé aux administrateurs." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { success: false, error: "Fichier illisible — xlsx attendu." };
  }

  const { lignes, erreurs } = parseMondayWorkbook(wb);
  if (lignes.length === 0) {
    return { success: false, error: erreurs[0] ?? "Aucune ligne client détectée." };
  }

  const [existants, modeles] = await Promise.all([
    prisma.client.findMany({
      select: {
        id: true,
        codeMonday: true,
        raisonSociale: true,
        adresse: true,
        sites: { select: { codeMonday: true, adresse: true } },
      },
    }),
    prisma.modeleEquipement.findMany({ select: { libelle: true, alias: true } }),
  ]);

  const modelesConnus = modeles.flatMap((m) => [m.libelle, ...m.alias]);
  const resultat = rapprocher(lignes, existants, modelesConnus);

  return {
    success: true,
    payload: {
      nomFichier: fichier.name,
      tailleOctets: fichier.size,
      resultat,
      erreurs,
    },
  };
}

export async function validerAction(
  payload: PrevisualisationPayload,
  decisions: Record<number, string>,
  // Décision par ligne « plusieurs sites » : "site" (défaut), "maj" ou "ignorer".
  decisionsSites: Record<number, string> = {}
): Promise<{ success: true; resultat: ApplicationResultat } | { success: false; error: string }> {
  const admin = await exigerAdmin();
  if (!admin) return { success: false, error: "Réservé aux administrateurs." };

  const manquantes = payload.resultat.aRapprocher.filter((_, i) => !decisions[i]);
  if (manquantes.length > 0) {
    return {
      success: false,
      error: `${manquantes.length} ligne(s) à rapprocher sans décision.`,
    };
  }

  const resultat = await appliquerImport(
    payload.resultat.aCreer,
    payload.resultat.aMettreAJour,
    payload.resultat.aRapprocher.map((r, i) => ({
      ligne: r.ligne as MondayLigne,
      decision: decisions[i],
    })),
    payload.resultat.modelesInconnus,
    payload.nomFichier,
    payload.tailleOctets,
    admin.id,
    payload.resultat.sites.map((s, i) => ({
      ligne: s.ligne as MondayLigne,
      raisonSociale: s.raisonSociale,
      decision: decisionsSites[i] ?? "site",
    }))
  );

  revalidatePath("/import-monday");
  revalidatePath("/clients");
  return { success: true, resultat };
}
