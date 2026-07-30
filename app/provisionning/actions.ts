"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const CHAMPS_EDITABLES = [
  "commentaire",
  "statutBascule",
  "dateBascule",
] as const;
type ChampEditable = (typeof CHAMPS_EDITABLES)[number];

export async function updateNumeroCellAction(
  numeroId: string,
  champ: string,
  valeur: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }
  if (!CHAMPS_EDITABLES.includes(champ as ChampEditable)) {
    return { success: false, error: "Champ non éditable." };
  }

  try {
    const data: Record<string, string | Date> =
      champ === "dateBascule" ? { dateBascule: new Date(valeur) } : { [champ]: valeur };
    await prisma.numero.update({ where: { id: numeroId }, data });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function forcerControleAction(
  numeroId: string,
  motif: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié." };
  }
  if (!motif.trim()) {
    return { success: false, error: "Le motif est obligatoire." };
  }

  try {
    await prisma.numero.update({
      where: { id: numeroId },
      data: {
        controleNiveau: "OK",
        controleForce: true,
        controleMotif: motif,
        controlePar: session.user.id,
        controleLe: new Date(),
      },
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function ajouterLigneAction(
  clientId: string,
  type: "numero" | "equipement" | "complete"
): Promise<{ success: boolean; numeroId?: string; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }

  try {
    if (type === "equipement") {
      await prisma.equipement.create({
        data: { clientId, macBrut: "", macNormalise: "" },
      });
      revalidatePath("/");
      return { success: true };
    }

    const numero = await prisma.numero.create({
      data: {
        clientId,
        numeroBrut: "",
        numeroNormalise: "",
      },
    });

    if (type === "complete") {
      await prisma.equipement.create({
        data: { clientId, macBrut: "", macNormalise: "", utilisateurId: null },
      });
    }

    revalidatePath("/");
    return { success: true, numeroId: numero.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
