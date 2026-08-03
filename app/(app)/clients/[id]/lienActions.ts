"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  marquerLienCommande,
  marquerLienLivre,
  reinitialiserLien,
  updateLienChamps,
} from "@/lib/repositories/lienRepository";

type Resultat = { success: boolean; error?: string };

async function garde(fn: (email: string) => Promise<void>): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    await fn(session.user.email ?? "");
    revalidatePath("/clients");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function marquerLienCommandeAction(clientId: string): Promise<Resultat> {
  return garde((email) => marquerLienCommande(clientId, email));
}

export async function marquerLienLivreAction(clientId: string): Promise<Resultat> {
  return garde(() => marquerLienLivre(clientId));
}

export async function reinitialiserLienAction(clientId: string): Promise<Resultat> {
  return garde(() => reinitialiserLien(clientId));
}

export async function updateLienChampsAction(
  clientId: string,
  data: { lienOperateur?: string; lienReference?: string; lienLivraisonPrevue?: string }
): Promise<Resultat> {
  return garde(() => updateLienChamps(clientId, data));
}
