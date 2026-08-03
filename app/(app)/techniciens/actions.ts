"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  affecterTechnicien,
  creerTechnicien,
  supprimerTechnicien,
  updateTechnicien,
} from "@/lib/repositories/technicienRepository";

type Resultat = { success: boolean; error?: string };

async function garde(fn: () => Promise<Resultat | void>): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const r = await fn();
    revalidatePath("/techniciens");
    revalidatePath("/clients");
    return r ?? { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function affecterTechnicienAction(
  clientId: string,
  technicienId: string
): Promise<Resultat> {
  return garde(() => affecterTechnicien(clientId, technicienId || null));
}

export async function creerTechnicienAction(
  nom: string,
  prestataireId: string,
  departements: string
): Promise<Resultat> {
  return garde(async () => {
    if (!nom.trim()) return { success: false, error: "Nom obligatoire." };
    const deps = departements
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    await creerTechnicien(nom.trim(), prestataireId || null, deps);
  });
}

export async function updateTechnicienAction(
  id: string,
  data: { nom?: string; prestataireId?: string | null; departements?: string; actif?: boolean }
): Promise<Resultat> {
  return garde(() =>
    updateTechnicien(id, {
      ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
      ...(data.prestataireId !== undefined ? { prestataireId: data.prestataireId || null } : {}),
      ...(data.departements !== undefined
        ? { departements: data.departements.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean) }
        : {}),
      ...(data.actif !== undefined ? { actif: data.actif } : {}),
    })
  );
}

export async function supprimerTechnicienAction(id: string): Promise<Resultat> {
  return garde(async () => {
    const r = await supprimerTechnicien(id);
    if (!r.success) return r;
  });
}
