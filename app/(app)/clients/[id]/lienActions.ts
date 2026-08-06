"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { journaliser } from "@/lib/activite";
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
  return garde(async (email) => {
    await marquerLienCommande(clientId, email);
    await journaliser("Client", clientId, "Lien commandé");
  });
}

export async function marquerLienLivreAction(clientId: string): Promise<Resultat> {
  return garde(async () => {
    await marquerLienLivre(clientId);
    await journaliser("Client", clientId, "Lien livré");
  });
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
