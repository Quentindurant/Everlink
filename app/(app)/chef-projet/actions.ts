"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import {
  setCommentaireProjet,
  setSuiviProjet,
} from "@/lib/repositories/chefProjetRepository";
import { normaliserNumeroSerie, valideSaisieOnt } from "@/lib/domain/staging/ont";

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

// L'étape ONT ne se coche pas comme les autres : elle exige une saisie. Un numéro crée
// l'appareil au stock staging ; une raison ferme l'étape en « Aucun » sans rien créer.
export async function enregistrerOntAction(
  clientId: string,
  etapeId: string,
  numeroSerie: string,
  raison: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const numero = normaliserNumeroSerie(numeroSerie);
  // On ne charge que le numéro saisi, pas tout le stock : la vérification d'unicité doit
  // rester une requête indexée, pas un scan.
  const existants = new Map<string, string>();
  if (numero) {
    const deja = await prisma.articleStock.findFirst({
      where: { type: "ONT", numeroSerie: numero, archiveA: null },
      select: { clientFinalTexte: true, client: { select: { raisonSociale: true } } },
    });
    if (deja) {
      existants.set(
        numero,
        deja.client?.raisonSociale ?? deja.clientFinalTexte ?? "un autre dossier"
      );
    }
  }

  const verdict = valideSaisieOnt({ numeroSerie, raison }, existants);
  if (!verdict.ok) return { success: false, error: verdict.message };

  if (verdict.mode === "numero") {
    await prisma.articleStock.create({
      data: {
        type: "ONT",
        origine: "CLIENT",
        numeroSerie: verdict.numeroSerie,
        clientId,
        statut: "EN_STOCK",
      },
    });
    await setSuiviProjet(clientId, etapeId, "Fait", session.user.email ?? null);
    await journaliser("Client", clientId, "ONT récupéré", verdict.numeroSerie);
  } else {
    await setSuiviProjet(clientId, etapeId, "Aucun", session.user.email ?? null);
    await setCommentaireProjet(clientId, etapeId, verdict.raison);
    await journaliser("Client", clientId, "ONT absent", verdict.raison);
  }

  revalidatePath("/chef-projet");
  revalidatePath("/staging/ont");
  return { success: true };
}
