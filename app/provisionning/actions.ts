"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normaliserNumero, normaliserMac } from "@/lib/domain/normalisation";
import { recalculerControle } from "@/lib/repositories/provisionningRepository";

const CHAMPS_EDITABLES = [
  "commentaire",
  "statutBascule",
  "numeroBrut",
  "numerosCourts",
] as const;
type ChampEditable = (typeof CHAMPS_EDITABLES)[number];

// Une ligne archivée reste jointe par id mais ne doit plus être écrite: la sélection du client
// peut porter un id périmé (revalidate en vol, onglet resté ouvert). `updateMany` + count === 0
// transforme silencieusement l'écriture en refus explicite.
const INTROUVABLE = "Ligne introuvable ou archivée.";

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
    const data: Record<string, string | string[]> =
      champ === "numeroBrut"
        ? { numeroBrut: valeur, numeroNormalise: normaliserNumero(valeur) }
        : champ === "numerosCourts"
          ? { numerosCourts: valeur.split("/").map((s) => s.trim()).filter(Boolean) }
          : { [champ]: valeur };
    const result = await prisma.numero.updateMany({
      where: { id: numeroId, archiveA: null, client: { archiveA: null } },
      data,
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
    // SPEC §5: le contrôle est recalculé à l'écriture. Recalcul systématique plutôt que par
    // champ: la règle d'unicité globale fait qu'une écriture peut changer le contrôle d'un
    // autre numéro, le coût d'un recalcul est négligeable devant celui de rater un cas.
    await recalculerControle(numeroId);
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
    const result = await prisma.numero.updateMany({
      where: { id: numeroId, archiveA: null, client: { archiveA: null } },
      data: {
        controleNiveau: "OK",
        controleForce: true,
        controleMotif: motif,
        controlePar: session.user.id,
        controleLe: new Date(),
      },
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
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
    const result = await prisma.equipement.updateMany({
      where: { id: equipementId, archiveA: null, client: { archiveA: null } },
      data: { macBrut, macNormalise: normaliserMac(macBrut) },
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

// Rattache (ou détache) un modèle à un équipement. C'est ce modèle qui décide de l'éligibilité
// export: sans lui, l'équipement est écarté du SDA et du MAC.
export async function updateEquipementModeleAction(
  equipementId: string,
  modeleId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }

  try {
    if (modeleId) {
      const modele = await prisma.modeleEquipement.findUnique({ where: { id: modeleId } });
      if (!modele) {
        return { success: false, error: "Modèle introuvable." };
      }
    }
    const result = await prisma.equipement.updateMany({
      where: { id: equipementId, archiveA: null, client: { archiveA: null } },
      // Un modèle reconnu prime sur le libellé brut d'import: on l'efface pour ne pas afficher
      // deux sources concurrentes.
      data: { modeleId: modeleId || null, ...(modeleId ? { modeleLibelleBrut: null } : {}) },
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
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
    const result = await prisma.utilisateur.updateMany({
      where: { id: utilisateurId, archiveA: null, client: { archiveA: null } },
      data: { nom },
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
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
    const client = await prisma.client.findFirst({
      where: { id: clientId, archiveA: null },
      select: { id: true },
    });
    if (!client) {
      return { success: false, error: "Client introuvable ou archivé." };
    }

    if (type === "equipement") {
      await prisma.equipement.create({
        data: { clientId, macBrut: "", macNormalise: normaliserMac("") },
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
          data: {
            clientId,
            utilisateurId: utilisateur.id,
            numeroBrut: "",
            numeroNormalise: normaliserNumero(""),
          },
        });
        await tx.equipement.create({
          data: {
            clientId,
            utilisateurId: utilisateur.id,
            macBrut: "",
            macNormalise: normaliserMac(""),
          },
        });
        return numero;
      });
      await recalculerControle(result.id);
      revalidatePath("/");
      return { success: true, numeroId: result.id };
    }

    const numero = await prisma.numero.create({
      data: {
        clientId,
        numeroBrut: "",
        numeroNormalise: normaliserNumero(""),
      },
    });

    await recalculerControle(numero.id);
    revalidatePath("/");
    return { success: true, numeroId: numero.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}

type ActionMasse =
  | { type: "hebergeurCible"; valeur: string }
  | { type: "basculeFaite"; date: string }
  | { type: "exclureExport"; valeur: boolean };

export async function actionMasseAction(
  numeroIds: string[],
  action: ActionMasse
): Promise<{ success: boolean; count?: number; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }
  if (numeroIds.length === 0) {
    return { success: false, error: "Aucune ligne sélectionnée." };
  }

  try {
    if (action.type === "hebergeurCible") {
      const numeros = await prisma.numero.findMany({
        where: { id: { in: numeroIds }, archiveA: null, client: { archiveA: null } },
        select: { clientId: true },
      });
      const clientIds = [...new Set(numeros.map((n) => n.clientId))];
      if (clientIds.length === 0) {
        return { success: false, error: INTROUVABLE };
      }
      const result = await prisma.client.updateMany({
        where: { id: { in: clientIds }, archiveA: null },
        data: { hebergeurCible: action.valeur },
      });
      revalidatePath("/");
      return { success: true, count: result.count };
    }

    if (action.type === "basculeFaite") {
      const result = await prisma.numero.updateMany({
        where: { id: { in: numeroIds }, archiveA: null, client: { archiveA: null } },
        data: { statutBascule: "Fait", dateBascule: new Date(action.date) },
      });
      if (result.count === 0) {
        return { success: false, error: INTROUVABLE };
      }
      revalidatePath("/");
      return { success: true, count: result.count };
    }

    const result = await prisma.numero.updateMany({
      where: { id: { in: numeroIds }, archiveA: null, client: { archiveA: null } },
      data: { exclureExport: action.valeur },
    });
    if (result.count === 0) {
      return { success: false, error: INTROUVABLE };
    }
    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
