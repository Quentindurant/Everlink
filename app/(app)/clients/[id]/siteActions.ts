"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";

type Resultat = { success: boolean; error?: string };

export async function renommerSiteAction(siteId: string, nom: string): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const t = nom.trim();
  if (!t) return { success: false, error: "Nom requis." };
  const site = await prisma.site.update({ where: { id: siteId }, data: { nom: t } });
  await journaliser("Client", site.clientId, "Renommage site", t);
  revalidatePath("/clients");
  return { success: true };
}

// Rattache un poste à l'un des sites du client (ou le détache si siteId vide).
export async function affecterSiteUtilisateurAction(
  utilisateurId: string,
  siteId: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { siteId: siteId || null },
  });
  revalidatePath("/clients");
  return { success: true };
}
