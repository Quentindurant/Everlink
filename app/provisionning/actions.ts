"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normaliserNumero, normaliserMac } from "@/lib/domain/normalisation";

const CHAMPS_EDITABLES = [
  "commentaire",
  "statutBascule",
  "dateBascule",
  "numeroBrut",
  "numerosCourts",
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
    const data: Record<string, string | Date | string[]> =
      champ === "dateBascule"
        ? { dateBascule: new Date(valeur) }
        : champ === "numeroBrut"
          ? { numeroBrut: valeur, numeroNormalise: normaliserNumero(valeur) }
          : champ === "numerosCourts"
            ? { numerosCourts: valeur.split("/").map((s) => s.trim()).filter(Boolean) }
            : { [champ]: valeur };
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

export async function updateEquipementMacAction(
  equipementId: string,
  macBrut: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }

  try {
    await prisma.equipement.update({
      where: { id: equipementId },
      data: { macBrut, macNormalise: normaliserMac(macBrut) },
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

export async function updateUtilisateurNomAction(
  utilisateurId: string,
  nom: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }

  try {
    await prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { nom },
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

    if (type === "complete") {
      const result = await prisma.$transaction(async (tx) => {
        const utilisateur = await tx.utilisateur.create({
          data: { clientId, nom: "" },
        });
        const numero = await tx.numero.create({
          data: { clientId, utilisateurId: utilisateur.id, numeroBrut: "", numeroNormalise: "" },
        });
        await tx.equipement.create({
          data: { clientId, utilisateurId: utilisateur.id, macBrut: "", macNormalise: "" },
        });
        return numero;
      });
      revalidatePath("/");
      return { success: true, numeroId: result.id };
    }

    const numero = await prisma.numero.create({
      data: {
        clientId,
        numeroBrut: "",
        numeroNormalise: "",
      },
    });

    revalidatePath("/");
    return { success: true, numeroId: numero.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
