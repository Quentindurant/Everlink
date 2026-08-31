"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import {
  affecterSiteRestants,
  affecterSiteUtilisateur,
  setEtapeClient,
  setSuiviEtape,
} from "@/lib/repositories/telephoneRepository";

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

// Affecte un poste à un site du client (clients multi-établissements).
export async function affecterSiteAction(
  utilisateurId: string,
  siteId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await affecterSiteUtilisateur(utilisateurId, siteId);
  revalidatePath("/telephone");
  return { success: true };
}

// Affecte tous les postes encore sans site à un site donné.
export async function affecterSiteRestantsAction(
  clientId: string,
  siteId: string
): Promise<{ success: boolean; error?: string; nb?: number }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const nb = await affecterSiteRestants(clientId, siteId);
  await journaliser("Client", clientId, "Affectation site des postes", `${nb} poste(s)`);
  revalidatePath("/telephone");
  return { success: true, nb };
}

// Met un dossier en pause côté téléphonie (client injoignable, litige, attente de sa part).
// Il reste visible mais signalé, et sort des dossiers à travailler. Le motif explique à
// l'équipe pourquoi on n'avance pas, plutôt que de laisser un dossier stagner sans raison.
export async function bloquerClientAction(
  clientId: string,
  motif: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Non authentifié." };
  await prisma.client.update({
    where: { id: clientId },
    data: {
      telephoneBloque: true,
      telephoneBloqueLe: new Date(),
      telephoneBloquePar: session.user.email,
      telephoneBloqueMotif: motif.trim() || null,
    },
  });
  await journaliser("Client", clientId, "Blocage téléphonie", motif.trim() || undefined);
  revalidatePath("/telephone");
  return { success: true };
}

export async function debloquerClientAction(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "Non authentifié." };
  await prisma.client.update({
    where: { id: clientId },
    data: {
      telephoneBloque: false,
      telephoneBloqueLe: null,
      telephoneBloquePar: null,
      telephoneBloqueMotif: null,
    },
  });
  await journaliser("Client", clientId, "Déblocage téléphonie");
  revalidatePath("/telephone");
  return { success: true };
}
