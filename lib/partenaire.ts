// Partenaire actif : EVERLINK ou INOVACOM. Le choix se fait depuis le logo de la barre
// latérale et se garde dans un cookie, mais l'isolement ne repose pas sur l'affichage —
// c'est ce module que les dépôts interrogent pour filtrer leurs requêtes. Un écran qui
// oublierait le filtre montrerait les dossiers de l'autre partenaire.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Nom du cookie portant le code du partenaire choisi. */
export const COOKIE_PARTENAIRE = "partenaire";

export interface PartenaireLite {
  id: string;
  code: string;
  nom: string;
  logo: string;
  site: string | null;
  mailMigration: string | null;
}

const CHAMPS = {
  id: true,
  code: true,
  nom: true,
  logo: true,
  site: true,
  mailMigration: true,
} as const;

export async function listPartenaires(): Promise<PartenaireLite[]> {
  return prisma.partenaire.findMany({
    where: { actif: true },
    select: CHAMPS,
    orderBy: { ordre: "asc" },
  });
}

/**
 * Partenaire actif de la requête en cours. Sans cookie — première visite, cookie effacé —
 * on retombe sur le premier partenaire actif plutôt que de tout afficher : mieux vaut un
 * périmètre restreint qu'un mélange des deux.
 */
export async function partenaireActif(): Promise<PartenaireLite | null> {
  const code = (await cookies()).get(COOKIE_PARTENAIRE)?.value;
  if (code) {
    const choisi = await prisma.partenaire.findFirst({
      where: { code, actif: true },
      select: CHAMPS,
    });
    if (choisi) return choisi;
  }
  return prisma.partenaire.findFirst({
    where: { actif: true },
    select: CHAMPS,
    orderBy: { ordre: "asc" },
  });
}

/**
 * Identifiant du partenaire actif, à injecter dans les `where` des dépôts.
 * Null si aucun partenaire n'est configuré — l'appelant ne filtre alors pas, sinon
 * l'application afficherait des listes vides sans expliquer pourquoi.
 */
export async function idPartenaireActif(): Promise<string | null> {
  return (await partenaireActif())?.id ?? null;
}

/**
 * Fragment de `where` Prisma pour restreindre au partenaire actif.
 *
 * Le filtre est strict : une ligne rattachée à personne n'apparaît nulle part. C'est
 * volontaire — l'isolement est le but, et une ligne visible des deux côtés le trahirait.
 * La migration rattache tout l'existant à EVERLINK ; toute création doit poser le
 * partenaire, sans quoi sa ligne devient invisible et le signale d'elle-même.
 */
export function filtrePartenaire(id: string | null) {
  return id ? { partenaireId: id } : {};
}
