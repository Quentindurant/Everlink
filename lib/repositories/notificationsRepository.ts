import { prisma } from "@/lib/prisma";

export interface NotificationLigne {
  id: string;
  type: string;
  titre: string;
  message: string;
  lien: string | null;
  creeLe: string;
  lu: boolean;
}

// Une notification par destinataire : « lu » est propre à chacun, sans table de jointure.
export async function creerNotifications(data: {
  destinataires: string[];
  type: string;
  titre: string;
  message: string;
  lien?: string | null;
  clientId?: string | null;
}): Promise<number> {
  const emails = [...new Set(data.destinataires.filter(Boolean))];
  if (emails.length === 0) return 0;
  const r = await prisma.notification.createMany({
    data: emails.map((destinataireEmail) => ({
      destinataireEmail,
      type: data.type,
      titre: data.titre,
      message: data.message,
      lien: data.lien ?? null,
      clientId: data.clientId ?? null,
    })),
  });
  return r.count;
}

// Emails des comptes actifs d'un rôle donné : destinataires d'une notification d'équipe.
export async function emailsParRole(role: "ADMIN" | "OPERATEUR" | "TOUS"): Promise<string[]> {
  const comptes = await prisma.utilisateurApp.findMany({
    where: { actif: true, ...(role === "TOUS" ? {} : { role }) },
    select: { email: true },
  });
  return comptes.map((c) => c.email);
}

export async function fetchNotifications(email: string, limite = 30): Promise<NotificationLigne[]> {
  const lignes = await prisma.notification.findMany({
    where: { destinataireEmail: email },
    orderBy: [{ luLe: { sort: "asc", nulls: "first" } }, { creeLe: "desc" }],
    take: limite,
  });
  return lignes.map((n) => ({
    id: n.id,
    type: n.type,
    titre: n.titre,
    message: n.message,
    lien: n.lien,
    creeLe: n.creeLe.toISOString(),
    lu: n.luLe !== null,
  }));
}

export async function compterNonLues(email: string): Promise<number> {
  return prisma.notification.count({ where: { destinataireEmail: email, luLe: null } });
}

export async function marquerLue(id: string, email: string): Promise<void> {
  // Le filtre sur l'email empêche de marquer lue la notification d'un collègue.
  await prisma.notification.updateMany({
    where: { id, destinataireEmail: email, luLe: null },
    data: { luLe: new Date() },
  });
}

export async function marquerToutesLues(email: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { destinataireEmail: email, luLe: null },
    data: { luLe: new Date() },
  });
}

// Évite de renvoyer chaque jour la même alerte : vrai si une notification de ce type existe
// déjà pour ce client depuis moins de `heures`.
export async function notificationRecenteExiste(
  clientId: string,
  type: string,
  heures = 20
): Promise<boolean> {
  const depuis = new Date(Date.now() - heures * 3600_000);
  const n = await prisma.notification.count({
    where: { clientId, type, creeLe: { gte: depuis } },
  });
  return n > 0;
}
