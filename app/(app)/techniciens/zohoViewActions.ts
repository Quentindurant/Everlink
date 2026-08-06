"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { lireLignesSheet, type LigneZoho } from "@/lib/zoho/zohoClient";
import { runZohoPull, type ZohoPullResultat } from "@/lib/zoho/syncDepuisSheet";
import { journaliser } from "@/lib/activite";

export async function rafraichirZohoAction(): Promise<{
  configure: boolean;
  onglet: string;
  lignes: LigneZoho[];
}> {
  const session = await auth();
  if (!session?.user) return { configure: false, onglet: "", lignes: [] };
  const { onglet, lignes } = await lireLignesSheet();
  return { configure: lignes.length > 0 || !!process.env.ZOHO_REFRESH_TOKEN, onglet, lignes };
}

// Synchronise le Sheet vers l'app (statut, date, heure, technicien des dossiers rapprochés).
export async function synchroniserDepuisZohoAction(): Promise<ZohoPullResultat> {
  const session = await auth();
  if (!session?.user) {
    return {
      succes: false, onglet: "", lignesSheet: 0, rapproches: 0, misAJour: 0,
      lignesInconnues: [], message: "Non authentifié.",
    };
  }
  const r = await runZohoPull();
  if (r.succes && r.misAJour > 0) {
    await journaliser("Zoho", "sheet", "Sync Zoho → app", `${r.misAJour} dossier(s)`);
  }
  revalidatePath("/techniciens");
  revalidatePath("/clients");
  return r;
}
