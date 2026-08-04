"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { parseSewanDevices, type SewanDeviceRow } from "@/lib/domain/import/sewanDevices";
import {
  importDevicesSewan,
  previewDevices,
  type DevicePreviewRow,
  type ImportDevicesResultat,
} from "@/lib/repositories/importDevicesRepository";

export async function previsualiserDevicesAction(
  clientId: string,
  formData: FormData
): Promise<
  | { success: true; rows: DevicePreviewRow[]; ignores: number }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  const texte = Buffer.from(await fichier.arrayBuffer()).toString("latin1");
  const { rows, ignores } = parseSewanDevices(texte);
  if (rows.length === 0) {
    return { success: false, error: "Aucun équipement détecté dans le fichier." };
  }
  const preview = await previewDevices(clientId, rows);
  return { success: true, rows: preview, ignores };
}

export async function validerDevicesAction(
  clientId: string,
  rows: SewanDeviceRow[]
): Promise<
  { success: true; resultat: ImportDevicesResultat } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importDevicesSewan(clientId, rows);
    revalidatePath("/");
    revalidatePath(`/clients/${clientId}`);
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}
