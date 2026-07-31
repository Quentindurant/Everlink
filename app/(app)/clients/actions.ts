"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  noterTentativeContact,
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
    revalidatePath("/");
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
  return garde(() => setEtapeMigration(clientId, etapeMigrationId));
}

export async function noterTentativeContactAction(clientId: string): Promise<Resultat> {
  return garde(() => noterTentativeContact(clientId));
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
