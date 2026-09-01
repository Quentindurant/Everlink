"use server";

import { revalidatePath } from "next/cache";
import type { CategorieListe, TypeMail } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { runSheetsSync } from "@/lib/sync/runSheetsSync";
import {
  creerModeleMail,
  setParametreApp,
  supprimerModeleMail,
  updateModeleMail,
} from "@/lib/repositories/mailRepository";
import {
  ajouterEtape,
  ajouterEtapeProjet,
  deplacerEtapeProjet,
  supprimerEtapeProjet,
  updateEtapeProjet,
  ajouterEtapeMigration,
  ajouterValeur,
  creerCompte,
  creerModele,
  deplacerEtape,
  deplacerEtapeMigration,
  recalculerControleGlobal,
  renommerEtape,
  renommerEtapeMigration,
  resetMotDePasse,
  setCompteActif,
  setCouleurEtapeMigration,
  setEtapeActif,
  setEtapeMigrationActif,
  setEtapeMigrationBloquant,
  setModeleEligibilite,
  setModeleExportSepare,
  setValeurActif,
  supprimerEtapeMigration,
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
export async function setModeleExportSepareAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setModeleExportSepare(id, v));
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

// --- Étapes de migration ---
export async function ajouterEtapeMigrationAction(libelle: string): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim()) return { success: false, error: "Libellé vide." };
    await ajouterEtapeMigration(libelle.trim());
  });
}
export async function renommerEtapeMigrationAction(
  id: string,
  libelle: string
): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim()) return { success: false, error: "Libellé vide." };
    await renommerEtapeMigration(id, libelle.trim());
  });
}
export async function setCouleurEtapeMigrationAction(id: string, couleur: string): Promise<Resultat> {
  return garde(() => setCouleurEtapeMigration(id, couleur));
}
export async function setEtapeMigrationBloquantAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setEtapeMigrationBloquant(id, v));
}
export async function setEtapeMigrationActifAction(id: string, v: boolean): Promise<Resultat> {
  return garde(() => setEtapeMigrationActif(id, v));
}
export async function deplacerEtapeMigrationAction(
  id: string,
  dir: "haut" | "bas"
): Promise<Resultat> {
  return garde(() => deplacerEtapeMigration(id, dir));
}
export async function supprimerEtapeMigrationAction(id: string): Promise<Resultat> {
  return garde(async () => {
    const r = await supprimerEtapeMigration(id);
    if (!r.success) return r;
  });
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
  revalidatePath("/provisionning");
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

// --- Modèles de mail ---
export async function updateModeleMailAction(
  id: string,
  data: { scenario?: string; objet?: string; corps?: string; actif?: boolean }
): Promise<Resultat> {
  return garde(() => updateModeleMail(id, data));
}
export async function creerModeleMailAction(
  scenario: string,
  type: TypeMail,
  objet: string,
  corps: string
): Promise<Resultat> {
  return garde(async () => {
    if (!scenario.trim() || !objet.trim())
      return { success: false, error: "Scénario et objet obligatoires." };
    await creerModeleMail(scenario.trim(), type, objet.trim(), corps);
  });
}
export async function supprimerModeleMailAction(id: string): Promise<Resultat> {
  return garde(() => supprimerModeleMail(id));
}

// Paramètres d'envoi de mail (signature, adresse en copie).
export async function updateParametreAppAction(
  cle: "signatureMail" | "copieMail",
  valeur: string
): Promise<Resultat> {
  return garde(() => setParametreApp(cle, valeur.trim()));
}

// --- Étapes de préparation du chef de projet ---

export async function ajouterEtapeProjetAction(libelle: string, phase: string): Promise<Resultat> {
  return garde(async () => {
    if (!libelle.trim() || !phase.trim())
      return { success: false, error: "Libellé et phase obligatoires." };
    await ajouterEtapeProjet(libelle.trim(), phase.trim());
    revalidatePath("/chef-projet");
  });
}

export async function updateEtapeProjetAction(
  id: string,
  data: { libelle?: string; phase?: string; aide?: string; actif?: boolean }
): Promise<Resultat> {
  return garde(async () => {
    await updateEtapeProjet(id, {
      ...(data.libelle !== undefined ? { libelle: data.libelle.trim() } : {}),
      ...(data.phase !== undefined ? { phase: data.phase.trim() } : {}),
      ...(data.aide !== undefined ? { aide: data.aide } : {}),
      ...(data.actif !== undefined ? { actif: data.actif } : {}),
    });
    revalidatePath("/chef-projet");
  });
}

export async function deplacerEtapeProjetAction(
  id: string,
  direction: "haut" | "bas"
): Promise<Resultat> {
  return garde(async () => {
    await deplacerEtapeProjet(id, direction);
    revalidatePath("/chef-projet");
  });
}

export async function supprimerEtapeProjetAction(id: string): Promise<Resultat> {
  return garde(async () => {
    const r = await supprimerEtapeProjet(id);
    if (!r.success) return r;
    revalidatePath("/chef-projet");
  });
}
