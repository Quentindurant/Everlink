"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  importNumerosV4,
  parseNumerosV4Workbook,
  previewNumerosV4,
  type ImportNumerosResultat,
  type NumeroV4Preview,
  type NumeroV4Row,
} from "@/lib/repositories/importNumerosRepository";

export async function previsualiserNumerosV4Action(
  clientId: string,
  formData: FormData
): Promise<
  | { success: true; rows: NumeroV4Preview[]; ignores: number }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const { rows, ignores } = await parseNumerosV4Workbook(buffer);
  if (rows.length === 0) {
    return { success: false, error: "Aucun numéro détecté (export Sewan v4 attendu)." };
  }
  const preview = await previewNumerosV4(clientId, rows);
  return { success: true, rows: preview, ignores };
}

export async function validerNumerosV4Action(
  clientId: string,
  rows: NumeroV4Row[]
): Promise<
  { success: true; resultat: ImportNumerosResultat } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importNumerosV4(clientId, rows);
    revalidatePath("/provisionning");
    revalidatePath(`/clients/${clientId}`);
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}
