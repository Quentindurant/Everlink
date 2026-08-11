"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import {
  setCommentaireProjet,
  setSuiviProjet,
} from "@/lib/repositories/chefProjetRepository";

type Resultat = { success: boolean; error?: string };

export async function setSuiviProjetAction(
  clientId: string,
  etapeId: string,
  statut: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    await setSuiviProjet(clientId, etapeId, statut, session.user.email ?? null);
    await journaliser("Client", clientId, "Préparation projet", statut);
  } catch {
    return { success: false, error: "Échec de la sauvegarde." };
  }
  revalidatePath("/chef-projet");
  return { success: true };
}

export async function setCommentaireProjetAction(
  clientId: string,
  etapeId: string,
  commentaire: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await setCommentaireProjet(clientId, etapeId, commentaire);
  revalidatePath("/chef-projet");
  return { success: true };
}

// S'attribue (ou libère) la préparation d'un dossier : deux chefs de projet ne travaillent
// pas le même client en parallèle.
export async function attribuerProjetAction(
  clientId: string,
  prendre: boolean
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Non authentifié." };
  await prisma.client.update({
    where: { id: clientId },
    data: prendre
      ? { projetAttribueA: session.user.email, projetAttribueLe: new Date() }
      : { projetAttribueA: null, projetAttribueLe: null },
  });
  await journaliser(
    "Client",
    clientId,
    prendre ? "Attribution préparation projet" : "Libération préparation projet",
    session.user.email
  );
  revalidatePath("/chef-projet");
  return { success: true };
}

// Ferme (ou rouvre) la checklist : le dossier sort de la liste active sans rien perdre.
export async function cloreProjetAction(clientId: string, fermer: boolean): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await prisma.client.update({
    where: { id: clientId },
    data: { projetClosLe: fermer ? new Date() : null },
  });
  await journaliser(
    "Client",
    clientId,
    fermer ? "Clôture préparation projet" : "Réouverture préparation projet"
  );
  revalidatePath("/chef-projet");
  return { success: true };
}
