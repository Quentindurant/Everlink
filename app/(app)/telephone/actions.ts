"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import { setEtapeClient, setSuiviEtape } from "@/lib/repositories/telephoneRepository";

export async function setSuiviEtapeAction(
  utilisateurId: string,
  etapeId: string,
  statut: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    await setSuiviEtape(utilisateurId, etapeId, statut, session.user.email ?? null);
    await journaliser("Utilisateur", utilisateurId, "Suivi téléphonie", statut);
  } catch {
    return { success: false, error: "Échec de la sauvegarde." };
  }
  revalidatePath("/telephone");
  return { success: true };
}

// S'attribue (ou libère) la migration téléphone d'un client : le nom s'affiche sur la
// bande du client pour que deux techs ne travaillent pas le même dossier en parallèle.
export async function attribuerClientTelephoneAction(
  clientId: string,
  prendre: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Non authentifié." };
  await prisma.client.update({
    where: { id: clientId },
    data: prendre
      ? { telephoneAttribueA: session.user.email, telephoneAttribueLe: new Date() }
      : { telephoneAttribueA: null, telephoneAttribueLe: null },
  });
  await journaliser(
    "Client",
    clientId,
    prendre ? "Attribution téléphone" : "Libération téléphone",
    session.user.email
  );
  revalidatePath("/telephone");
  return { success: true };
}

export async function setEtapeClientAction(
  clientId: string,
  etapeId: string,
  statut: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    await setEtapeClient(clientId, etapeId, statut, session.user.email ?? null);
    await journaliser("Client", clientId, "Suivi téléphonie (toute une étape)", statut);
  } catch {
    return { success: false, error: "Échec de l'action." };
  }
  revalidatePath("/telephone");
  return { success: true };
}
