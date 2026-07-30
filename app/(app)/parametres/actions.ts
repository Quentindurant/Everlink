"use server";

import { revalidatePath } from "next/cache";
import type { CategorieListe } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { runSheetsSync } from "@/lib/sync/runSheetsSync";
import {
  ajouterEtape,
  ajouterValeur,
  creerCompte,
  creerModele,
  deplacerEtape,
  recalculerControleGlobal,
  renommerEtape,
  resetMotDePasse,
  setCompteActif,
  setEtapeActif,
  setModeleEligibilite,
  setValeurActif,
  supprimerValeur,
} from "@/lib/repositories/parametresRepository";

type Resultat = { success: boolean; error?: string };

async function exigerAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id as string };
}

function ok(): Resultat {
  revalidatePath("/parametres");
  return { success: true };
}

async function garde(fn: () => Promise<Resultat | void>): Promise<Resultat> {
  const admin = await exigerAdmin();
  if (!admin) return { success: false, error: "Réservé aux administrateurs." };
  try {
    const r = await fn();
    return r ?? ok();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Valeur déjà existante." };
    }
    return { success: false, error: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function setModeleEligibiliteAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setModeleEligibilite(id, v));
}
export async function creerModeleAction(libelle: string, marque: string): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim() || !marque.trim())
      return { success: false, error: "Libellé et marque obligatoires." };
    await creerModele(libelle.trim(), marque.trim());
  });
}

export async function ajouterValeurAction(
  categorie: CategorieListe,
  valeur: string
): Promise<Resultat> {
  return garde(async () => {
    if (!valeur.trim()) return { success: false, error: "Valeur vide." };
    await ajouterValeur(categorie, valeur.trim());
  });
}
export async function setValeurActifAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setValeurActif(id, v));
}
export async function supprimerValeurAction(id: string): Promise<Resultat> {
  return garde(async () => {
    const r = await supprimerValeur(id);
    if (!r.success) return r;
  });
}

export async function ajouterEtapeAction(libelle: string): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim()) return { success: false, error: "Libellé vide." };
    await ajouterEtape(libelle.trim());
  });
}
export async function renommerEtapeAction(id: string, libelle: string): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim()) return { success: false, error: "Libellé vide." };
    await renommerEtape(id, libelle.trim());
  });
}
export async function setEtapeActifAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setEtapeActif(id, v));
}
export async function deplacerEtapeAction(id: string, dir: "haut" | "bas"): Promise<Resultat> {
  return garde(() => deplacerEtape(id, dir));
}

export async function creerCompteAction(
  email: string,
  nom: string,
  role: "ADMIN" | "OPERATEUR",
  motDePasse: string
): Promise<Resultat> {
  return garde(async () => {
    if (!email.trim() || !nom.trim() || motDePasse.length < 8)
      return { success: false, error: "Email, nom requis et mot de passe ≥ 8 caractères." };
    await creerCompte(email.trim(), nom.trim(), role, motDePasse);
  });
}
export async function setCompteActifAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setCompteActif(id, v));
}
export async function resetMotDePasseAction(id: string, motDePasse: string): Promise<Resultat> {
  return garde(async () => {
    if (motDePasse.length < 8) return { success: false, error: "Mot de passe ≥ 8 caractères." };
    await resetMotDePasse(id, motDePasse);
  });
}

export async function recalculerControleGlobalAction(): Promise<{
  success: boolean;
  error?: string;
  nb?: number;
}> {
  const admin = await exigerAdmin();
  if (!admin) return { success: false, error: "Réservé aux administrateurs." };
  const nb = await recalculerControleGlobal();
  revalidatePath("/parametres");
  revalidatePath("/");
  return { success: true, nb };
}

export async function lancerSyncAction(): Promise<{ success: boolean; error?: string }> {
  const admin = await exigerAdmin();
  if (!admin) return { success: false, error: "Réservé aux administrateurs." };
  const result = await runSheetsSync("MANUEL", admin.id);
  revalidatePath("/parametres");
  if (!result.succes) {
    return { success: false, error: Object.values(result.erreurs)[0] ?? "Échec de la sync." };
  }
  return { success: true };
}
