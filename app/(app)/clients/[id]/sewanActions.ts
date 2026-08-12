"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { parseSewanUsers, type SewanUserRow } from "@/lib/domain/import/sewanUsers";
import {
  importUtilisateursSewan,
  type ImportSewanResultat,
} from "@/lib/repositories/importSewanRepository";

export async function previsualiserSewanAction(
  formData: FormData
): Promise<
  | { success: true; rows: SewanUserRow[]; ignores: number }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  // Export Sewan encodé en latin-1 (accents). On décode avant de parser.
  const texte = Buffer.from(await fichier.arrayBuffer()).toString("latin1");
  const { rows, ignores } = parseSewanUsers(texte);
  if (rows.length === 0) {
    return { success: false, error: "Aucun utilisateur avec numéro détecté dans le fichier." };
  }
  return { success: true, rows, ignores };
}

export async function validerSewanAction(
  clientId: string,
  rows: SewanUserRow[],
  dokoIndices: number[]
): Promise<{ success: true; resultat: ImportSewanResultat } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importUtilisateursSewan(clientId, rows, dokoIndices);
    revalidatePath("/provisionning");
    revalidatePath(`/clients/${clientId}`);
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}
