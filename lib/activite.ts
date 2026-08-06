// Journal d'activité et présence. Écrit dans AuditLog (déjà lu par l'historique de la fiche
// client) avec l'utilisateur connecté comme auteur. Toujours silencieux en cas d'échec :
// le suivi d'activité ne doit jamais faire échouer ni ralentir une action métier.
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// entite: "Client" | "Numero" | "Utilisateur" | "ArticleStock" | … (la fiche client affiche
// les entrées dont entiteId = id du client). action: libellé court lisible ("Étape migration").
export async function journaliser(
  entite: string,
  entiteId: string,
  action: string,
  apres?: string
): Promise<void> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return;
    await prisma.auditLog.create({
      data: {
        entite,
        entiteId,
        action,
        apres: apres ?? null,
        auteur: { connect: { email } },
      },
    });
  } catch {
    // volontairement silencieux
  }
}

// Marque l'utilisateur comme actif (throttle: au plus une écriture par minute).
export async function toucherPresence(email: string): Promise<void> {
  try {
    const seuil = new Date(Date.now() - 60_000);
    await prisma.utilisateurApp.updateMany({
      where: {
        email,
        OR: [{ derniereActiviteLe: null }, { derniereActiviteLe: { lt: seuil } }],
      },
      data: { derniereActiviteLe: new Date() },
    });
  } catch {
    // volontairement silencieux
  }
}
