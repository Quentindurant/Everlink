import { prisma } from "@/lib/prisma";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";

// Référentiel des étapes actives, ordonné. Consommé par la grille, la fiche client et les filtres.
export async function listEtapesMigration(): Promise<EtapeMigrationLite[]> {
  const etapes = await prisma.etapeMigration.findMany({
    where: { actif: true },
    orderBy: { ordre: "asc" },
    select: { id: true, libelle: true, ordre: true, couleur: true, estBloquant: true },
  });
  return etapes;
}

// Étape courante de chaque client actif, pour afficher le sélecteur sur les bandes de la grille
// Provisionning sans alourdir chaque ligne.
export async function mapEtapeParClient(): Promise<Record<string, string | null>> {
  const clients = await prisma.client.findMany({
    where: { archiveA: null },
    select: { id: true, etapeMigrationId: true },
  });
  return Object.fromEntries(clients.map((c) => [c.id, c.etapeMigrationId]));
}

// Change l'étape de migration d'un client.
export async function setEtapeMigration(clientId: string, etapeMigrationId: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: { etapeMigrationId },
  });
}

// Enregistre une tentative de contact (incrément + horodatage).
export async function noterTentativeContact(clientId: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: { nbTentativesContact: { increment: 1 }, dernierContactLe: new Date() },
  });
}

// Annule une tentative comptée par erreur (double clic, mauvaise ligne). Jamais en dessous
// de zéro ; la date du dernier contact est effacée quand on retombe à zéro.
export async function retirerTentativeContact(clientId: string): Promise<void> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, archiveA: null },
    select: { nbTentativesContact: true },
  });
  if (!c || c.nbTentativesContact <= 0) return;
  const reste = c.nbTentativesContact - 1;
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: {
      nbTentativesContact: reste,
      ...(reste === 0 ? { dernierContactLe: null } : {}),
    },
  });
}

// Passe le client sur la première étape bloquante du référentiel.
export async function passerBloque(clientId: string): Promise<{ success: boolean; error?: string }> {
  const bloquante = await prisma.etapeMigration.findFirst({
    where: { estBloquant: true, actif: true },
    orderBy: { ordre: "asc" },
  });
  if (!bloquante) return { success: false, error: "Aucune étape bloquante configurée." };
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: { etapeMigrationId: bloquante.id },
  });
  return { success: true };
}

export async function updateReferenceClient(clientId: string, valeur: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: { referenceClient: valeur.trim() || null },
  });
}
