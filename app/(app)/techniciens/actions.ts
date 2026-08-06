"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  affecterTechnicien,
  creerTechnicien,
  supprimerTechnicien,
  updateTechnicien,
} from "@/lib/repositories/technicienRepository";
import { numeroSuiviValide } from "@/lib/domain/tracking/laposte";
import { suivreColis } from "@/lib/tracking/laPosteClient";
import { journaliser } from "@/lib/activite";

type Resultat = { success: boolean; error?: string };

async function garde(fn: () => Promise<Resultat | void>): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  try {
    const r = await fn();
    revalidatePath("/techniciens");
    revalidatePath("/clients");
    return r ?? { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function affecterTechnicienAction(
  clientId: string,
  technicienId: string
): Promise<Resultat> {
  return garde(async () => {
    await affecterTechnicien(clientId, technicienId || null);
    await journaliser("Client", clientId, "Affectation technicien");
  });
}

// Met à jour un champ du suivi ADV (colonnes du TABLEAU SUIVI COMMANDES pilotées depuis
// l'app). Chaîne vide = effacement (null en base).
export async function updateSuiviAdvAction(
  clientId: string,
  champ: "statutSuivi" | "materielRecu" | "numeroChrono" | "infosFacturation" | "dateImperative",
  valeur: string
): Promise<Resultat> {
  return garde(async () => {
    const v = valeur.trim();
    await prisma.client.update({
      where: { id: clientId },
      data:
        champ === "dateImperative"
          ? { dateImperative: v ? new Date(v) : null }
          : { [champ]: v || null },
    });
    if (champ === "statutSuivi") await journaliser("Client", clientId, "Statut ADV", v || undefined);
  });
}

// Enregistre le numéro de suivi du colis client (routeur/lien) et relève un premier état.
// Numéro vide = on efface le suivi. Le cron rafraîchira ensuite l'état.
export async function setColisSuiviAction(
  clientId: string,
  numeroSuivi: string,
  transporteur = "Chronopost"
): Promise<Resultat> {
  return garde(async () => {
    const num = numeroSuivi.trim();
    if (!num) {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          colisNumeroSuivi: null,
          colisTransporteur: null,
          colisSuiviStatut: null,
          colisSuiviLibelle: null,
          colisSuiviLivreLe: null,
          colisSuiviMajLe: null,
        },
      });
      return;
    }
    if (!numeroSuiviValide(num)) {
      return { success: false, error: "Numéro de suivi invalide (11 à 15 caractères)." };
    }
    const etat = await suivreColis(num);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        colisNumeroSuivi: num,
        colisTransporteur: transporteur.trim() || "Chronopost",
        colisSuiviStatut: etat?.statut ?? null,
        colisSuiviLibelle: etat?.libelle ?? null,
        colisSuiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
        colisSuiviMajLe: new Date(),
      },
    });
    await journaliser("Client", clientId, "Suivi colis", num);
  });
}

// Marque (ou non) qu'on réutilise le routeur déjà présent chez le client, au lieu d'en envoyer
// un depuis le stock.
export async function setRouteurClientReutiliseAction(
  clientId: string,
  valeur: boolean
): Promise<Resultat> {
  return garde(async () => {
    await prisma.client.update({ where: { id: clientId }, data: { routeurClientReutilise: valeur } });
  });
}

export async function creerTechnicienAction(
  nom: string,
  prestataireId: string,
  departements: string
): Promise<Resultat> {
  return garde(async () => {
    if (!nom.trim()) return { success: false, error: "Nom obligatoire." };
    const deps = departements
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    await creerTechnicien(nom.trim(), prestataireId || null, deps);
  });
}

export async function updateTechnicienAction(
  id: string,
  data: { nom?: string; prestataireId?: string | null; departements?: string; actif?: boolean }
): Promise<Resultat> {
  return garde(() =>
    updateTechnicien(id, {
      ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
      ...(data.prestataireId !== undefined ? { prestataireId: data.prestataireId || null } : {}),
      ...(data.departements !== undefined
        ? { departements: data.departements.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean) }
        : {}),
      ...(data.actif !== undefined ? { actif: data.actif } : {}),
    })
  );
}

export async function supprimerTechnicienAction(id: string): Promise<Resultat> {
  return garde(async () => {
    const r = await supprimerTechnicien(id);
    if (!r.success) return r;
  });
}
