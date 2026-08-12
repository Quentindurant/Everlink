"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { TypeMail } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { envoyerMail } from "@/lib/mail/mailer";
import { enregistrerEnvoi, getParametreApp } from "@/lib/repositories/mailRepository";

type Resultat = { success: boolean; error?: string };

// Étape à laquelle avancer le client après un envoi réussi.
const ETAPE_APRES_ENVOI: Record<TypeMail, string> = {
  PREVENANCE: "Prévenance envoyée",
  CONFIRMATION: "RDV planifié",
};

export async function envoyerMailAction(
  clientId: string,
  type: TypeMail,
  destinataire: string,
  objet: string,
  corps: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  if (!destinataire.trim()) return { success: false, error: "Destinataire manquant." };

  // CustomID Mailjet : corrélation avec l'état de délivrabilité relevé par le cron.
  const customId = randomUUID();
  // Copie systématique (paramètre « copieMail »), sauf si c'est déjà le destinataire.
  const copie = (await getParametreApp("copieMail"))?.trim() || undefined;
  const envoi = await envoyerMail({
    to: destinataire.trim(),
    subject: objet,
    text: corps,
    customId,
    cc: copie && copie.toLowerCase() !== destinataire.trim().toLowerCase() ? copie : undefined,
  });

  await enregistrerEnvoi({
    clientId,
    type,
    destinataire: destinataire.trim(),
    objet,
    corps,
    succes: envoi.success,
    erreur: envoi.error,
    auteurId: session.user.id ?? null,
    mailjetCustomId: envoi.success ? customId : null,
  });

  // Auto-avancement de l'étape de migration (uniquement si l'envoi a réussi).
  if (envoi.success) {
    const etape = await prisma.etapeMigration.findFirst({
      where: { libelle: ETAPE_APRES_ENVOI[type], actif: true },
      select: { id: true },
    });
    if (etape) {
      await prisma.client.updateMany({
        where: { id: clientId, archiveA: null },
        data: { etapeMigrationId: etape.id },
      });
    }
  }

  revalidatePath("/clients");
  revalidatePath("/provisionning");
  if (!envoi.success) return { success: false, error: envoi.error };
  return { success: true };
}

export async function setCreneauInterventionAction(
  clientId: string,
  dateIso: string,
  creneau: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: {
      dateIntervention: dateIso ? new Date(dateIso) : null,
      creneauIntervention: creneau.trim() || null,
    },
  });
  revalidatePath("/clients");
  return { success: true };
}
