import { prisma } from "@/lib/prisma";

// Marque la commande de lien comme lancée (date + ADV). Idempotent sur la date: ne réécrit pas
// si déjà commandé.
export async function marquerLienCommande(clientId: string, adv: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null, lienCommande: false },
    data: { lienCommande: true, lienCommandeLe: new Date(), lienCommandePar: adv },
  });
}

// Marque le lien comme livré (date). Avance l'étape de migration à "Lien livré".
export async function marquerLienLivre(clientId: string): Promise<void> {
  const etape = await prisma.etapeMigration.findFirst({
    where: { libelle: "Lien livré", actif: true },
    select: { id: true },
  });
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: {
      lienLivre: true,
      lienLivreLe: new Date(),
      lienCommande: true, // livré implique commandé
      ...(etape ? { etapeMigrationId: etape.id } : {}),
    },
  });
}

// Annule le suivi (repasse en non commandé) — pour corriger une saisie.
export async function reinitialiserLien(clientId: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: {
      lienCommande: false,
      lienCommandeLe: null,
      lienLivre: false,
      lienLivreLe: null,
    },
  });
}

export async function updateLienChamps(
  clientId: string,
  data: { lienOperateur?: string; lienReference?: string; lienLivraisonPrevue?: string }
): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: {
      ...(data.lienOperateur !== undefined ? { lienOperateur: data.lienOperateur.trim() || null } : {}),
      ...(data.lienReference !== undefined ? { lienReference: data.lienReference.trim() || null } : {}),
      ...(data.lienLivraisonPrevue !== undefined
        ? { lienLivraisonPrevue: data.lienLivraisonPrevue ? new Date(data.lienLivraisonPrevue) : null }
        : {}),
    },
  });
}
