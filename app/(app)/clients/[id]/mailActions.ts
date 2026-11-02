"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { TypeMail } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { envoyerMail } from "@/lib/mail/mailer";
import {
  compterSoftphones,
  enregistrerEnvoi,
  fetchPartenaireEnvoiDuClient,
  getParametreApp,
} from "@/lib/repositories/mailRepository";
import { listerGuides } from "@/lib/mail/guides";
import { signatureDepuisPartenaire } from "@/lib/mail/signature";
import { adressesCopie, restreindreCopie } from "@/lib/domain/mail/copie";

type Resultat = { success: boolean; error?: string };

// Étape à laquelle avancer le client après un envoi réussi. Une relance ne fait pas
// avancer le dossier : elle répète une étape déjà franchie.
const ETAPE_APRES_ENVOI: Partial<Record<TypeMail, string>> = {
  PREVENANCE: "Prévenance envoyée",
  CONFIRMATION: "RDV planifié",
};

export async function envoyerMailAction(
  clientId: string,
  type: TypeMail,
  destinataire: string,
  objet: string,
  corps: string,
  // Adresses gardées en copie après les retraits faits dans le composeur.
  copieRetenue?: string[]
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  if (!destinataire.trim()) return { success: false, error: "Destinataire manquant." };

  // CustomID Mailjet : corrélation avec l'état de délivrabilité relevé par le cron.
  const customId = randomUUID();
  // Le mail part au nom du partenaire du dossier : sa copie, sa signature, son expéditeur.
  // Un dossier sans partenaire garde l'ancien comportement (copie globale, signature EverLink).
  const partenaire = await fetchPartenaireEnvoiDuClient(clientId);
  const saisieCopie = partenaire ? partenaire.copieMail : await getParametreApp("copieMail");
  // Guides Speek joints à la confirmation d'un client qui a des softphones à réinstaller.
  const piecesJointes =
    type === "CONFIRMATION" && (await compterSoftphones(clientId)) > 0
      ? await listerGuides()
      : [];
  const envoi = await envoyerMail({
    to: destinataire.trim(),
    subject: objet,
    text: corps,
    customId,
    cc: restreindreCopie(adressesCopie(saisieCopie, destinataire), copieRetenue),
    piecesJointes,
    ...(partenaire
      ? { signature: signatureDepuisPartenaire(partenaire), expediteur: partenaire.expediteur }
      : {}),
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
  const libelleEtape = ETAPE_APRES_ENVOI[type];
  if (envoi.success && libelleEtape) {
    const etape = await prisma.etapeMigration.findFirst({
      where: { libelle: libelleEtape, actif: true },
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
