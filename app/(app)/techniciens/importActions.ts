"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  importerTechniciens,
  parseTechniciensWorkbook,
  type ImportTechResultat,
  type TechnicienImportRow,
} from "@/lib/repositories/importTechniciensRepository";

export async function previsualiserTechniciensAction(
  formData: FormData
): Promise<{ success: true; rows: TechnicienImportRow[] } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  try {
    const buffer = Buffer.from(await fichier.arrayBuffer());
    const rows = await parseTechniciensWorkbook(buffer);
    if (rows.length === 0) return { success: false, error: "Aucun technicien détecté." };
    return { success: true, rows };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Fichier illisible." };
  }
}

export async function validerTechniciensAction(
  rows: TechnicienImportRow[]
): Promise<{ success: true; resultat: ImportTechResultat } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importerTechniciens(rows);
    revalidatePath("/techniciens");
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}
