"use server";

// Vue live et synchronisation du tableau de suivi maison (remplace le Zoho Sheet). Les
// noms des actions sont conservés (rafraichirZohoAction, synchroniserDepuisZohoAction)
// pour ne pas toucher les composants appelants ; les formes retournées sont identiques.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { LigneSuivi } from "@/lib/domain/suivi/ligneSuivi";
import { lireVueSuivi } from "@/lib/suivi/vueSuivi";
import { runSuiviPull, type SuiviPullResultat } from "@/lib/suivi/syncDepuisSuivi";
import { journaliser } from "@/lib/activite";

export async function rafraichirZohoAction(): Promise<{
  configure: boolean;
  onglet: string;
  lignes: LigneSuivi[];
}> {
  const session = await auth();
  if (!session?.user) return { configure: false, onglet: "", lignes: [] };
  return lireVueSuivi();
}

// Synchronise le tableau vers l'app (statut, date, heure, technicien des dossiers rapprochés).
export async function synchroniserDepuisZohoAction(): Promise<SuiviPullResultat> {
  const session = await auth();
  if (!session?.user) {
    return {
      succes: false, onglet: "", lignesSheet: 0, rapproches: 0, misAJour: 0,
      lignesInconnues: [], message: "Non authentifié.",
    };
  }
  const r = await runSuiviPull();
  if (r.succes && r.misAJour > 0) {
    await journaliser("Suivi", "tableau", "Sync tableau → app", `${r.misAJour} dossier(s)`);
  }
  revalidatePath("/techniciens");
  revalidatePath("/clients");
  return r;
}
