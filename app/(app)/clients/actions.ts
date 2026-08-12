"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { journaliser } from "@/lib/activite";
import {
  noterTentativeContact,
  retirerTentativeContact,
  passerBloque,
  setEtapeMigration,
  updateReferenceClient,
} from "@/lib/repositories/migrationRepository";

type Resultat = { success: boolean; error?: string };

async function garde(fn: () => Promise<Resultat | void>): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const r = await fn();
    revalidatePath("/provisionning");
    revalidatePath("/clients");
    return r ?? { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function setEtapeMigrationAction(
  clientId: string,
  etapeMigrationId: string
): Promise<Resultat> {
  return garde(async () => {
    await setEtapeMigration(clientId, etapeMigrationId);
    await journaliser("Client", clientId, "Étape migration");
  });
}

export async function noterTentativeContactAction(clientId: string): Promise<Resultat> {
  return garde(async () => {
    await noterTentativeContact(clientId);
    await journaliser("Client", clientId, "Tentative de contact");
  });
}

export async function retirerTentativeContactAction(clientId: string): Promise<Resultat> {
  return garde(async () => {
    await retirerTentativeContact(clientId);
    await journaliser("Client", clientId, "Annulation tentative de contact");
  });
}

export async function passerBloqueAction(clientId: string): Promise<Resultat> {
  return garde(async () => {
    const r = await passerBloque(clientId);
    if (!r.success) return r;
  });
}

export async function updateReferenceClientAction(
  clientId: string,
  valeur: string
): Promise<Resultat> {
  return garde(() => updateReferenceClient(clientId, valeur));
}
