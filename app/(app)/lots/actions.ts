"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { creerLot, updateLot } from "@/lib/repositories/lotsRepository";

export async function creerLotAction(
  nom: string,
  reference: string
): Promise<{ success: boolean; error?: string }> {
  if (!nom.trim()) return { success: false, error: "Le nom est obligatoire." };
  try {
    await creerLot(nom.trim(), reference.trim() || null);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Un lot porte déjà ce nom ou cette référence." };
    }
    throw e;
  }
  revalidatePath("/lots");
  return { success: true };
}

export async function updateLotAction(
  id: string,
  data: { nom?: string; reference?: string | null; clos?: boolean }
): Promise<{ success: boolean; error?: string }> {
  if (data.nom !== undefined && !data.nom.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }
  try {
    await updateLot(id, {
      ...data,
      nom: data.nom?.trim(),
      reference: data.reference === undefined ? undefined : data.reference?.trim() || null,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Un lot porte déjà ce nom ou cette référence." };
    }
    throw e;
  }
  revalidatePath("/lots");
  return { success: true };
}
