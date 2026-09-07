"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_PARTENAIRE } from "@/lib/partenaire";

// Bascule de partenaire depuis le logo. Le cookie est lu par partenaireActif() à chaque
// requête serveur, donc tout le rendu suit — d'où la revalidation de l'arbre entier plutôt
// que d'une page : les listes, les compteurs et la barre latérale changent ensemble.
export async function choisirPartenaireAction(code: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_PARTENAIRE, code, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Un an : le périmètre de travail change rarement, et le redemander à chaque session
    // ferait travailler quelqu'un sur le mauvais partenaire sans s'en apercevoir.
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
