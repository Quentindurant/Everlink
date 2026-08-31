"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import { creerNotifications, emailsParRole } from "@/lib/repositories/notificationsRepository";

type Resultat = { success: boolean; error?: string };

async function garde() {
  const session = await auth();
  return session?.user?.email ?? null;
}

// Ajout d'un prestataire par l'ADV. Les techniciens sont prévenus tout de suite : c'est eux
// qui devront l'appeler avant l'intervention, et ils n'ouvrent pas la fiche tous les jours.
export async function ajouterPrestataireAction(
  clientId: string,
  data: {
    metier: string;
    societe: string;
    contactNom?: string;
    telephone?: string;
    email?: string;
    commentaire?: string;
  }
): Promise<Resultat> {
  const email = await garde();
  if (!email) return { success: false, error: "Non authentifié." };
  const metier = data.metier.trim();
  const societe = data.societe.trim();
  if (!metier || !societe) return { success: false, error: "Métier et société obligatoires." };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { raisonSociale: true },
  });
  if (!client) return { success: false, error: "Client introuvable." };

  await prisma.prestataireClient.create({
    data: {
      clientId,
      metier,
      societe,
      contactNom: data.contactNom?.trim() || null,
      telephone: data.telephone?.trim() || null,
      email: data.email?.trim() || null,
      commentaire: data.commentaire?.trim() || null,
      creePar: email,
    },
  });

  // Tout le monde sauf l'auteur : inutile de se notifier soi-même.
  const destinataires = (await emailsParRole("TOUS")).filter((e) => e !== email);
  await creerNotifications({
    destinataires,
    type: "PRESTATAIRE_AJOUTE",
    titre: `Prestataire à contacter — ${client.raisonSociale}`,
    message: `${metier} · ${societe}${data.telephone ? ` · ${data.telephone}` : ""}`,
    lien: `/clients/${clientId}`,
    clientId,
  });
  await journaliser("Client", clientId, "Ajout prestataire", `${metier} · ${societe}`);
  revalidatePath("/clients");
  revalidatePath("/telephone");
  return { success: true };
}

export async function modifierPrestataireAction(
  id: string,
  data: Partial<{
    metier: string;
    societe: string;
    contactNom: string;
    telephone: string;
    email: string;
    commentaire: string;
  }>
): Promise<Resultat> {
  const email = await garde();
  if (!email) return { success: false, error: "Non authentifié." };
  const propre = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v])
  );
  await prisma.prestataireClient.update({ where: { id }, data: propre });
  revalidatePath("/clients");
  return { success: true };
}

// Le technicien tranche : joint, injoignable, ou hors sujet. La note explique le contexte
// (« rappeler après 14h », « ne gère plus ce site »).
export async function setContactPrestataireAction(
  id: string,
  statut: "A_CONTACTER" | "CONTACTE" | "INJOIGNABLE" | "SANS_OBJET",
  note?: string
): Promise<Resultat> {
  const email = await garde();
  if (!email) return { success: false, error: "Non authentifié." };
  const p = await prisma.prestataireClient.update({
    where: { id },
    data: {
      statutContact: statut,
      // Repasser « à contacter » efface la trace : le dossier redevient ouvert.
      contacteLe: statut === "A_CONTACTER" ? null : new Date(),
      contactePar: statut === "A_CONTACTER" ? null : email,
      ...(note !== undefined ? { noteContact: note.trim() || null } : {}),
    },
    select: { clientId: true, societe: true },
  });
  await journaliser("Client", p.clientId, "Contact prestataire", `${p.societe} → ${statut}`);
  revalidatePath("/clients");
  revalidatePath("/telephone");
  return { success: true };
}

export async function supprimerPrestataireAction(id: string): Promise<Resultat> {
  const email = await garde();
  if (!email) return { success: false, error: "Non authentifié." };
  const p = await prisma.prestataireClient.delete({
    where: { id },
    select: { clientId: true, societe: true },
  });
  await journaliser("Client", p.clientId, "Suppression prestataire", p.societe);
  revalidatePath("/clients");
  revalidatePath("/telephone");
  return { success: true };
}
