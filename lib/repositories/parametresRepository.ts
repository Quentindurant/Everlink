import bcrypt from "bcryptjs";
import type { CategorieListe } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculerControle } from "@/lib/repositories/provisionningRepository";

// ---------------------------------------------------------------- Modèles d'équipement

export interface ModeleLigne {
  id: string;
  libelle: string;
  marque: string;
  eligibleExport: boolean;
  alias: string[];
  actif: boolean;
  nbEquipements: number;
}

export async function fetchModeles(): Promise<ModeleLigne[]> {
  const modeles = await prisma.modeleEquipement.findMany({
    include: { _count: { select: { equipements: true } } },
    orderBy: [{ marque: "asc" }, { libelle: "asc" }],
  });
  return modeles.map((m) => ({
    id: m.id,
    libelle: m.libelle,
    marque: m.marque,
    eligibleExport: m.eligibleExport,
    alias: m.alias,
    actif: m.actif,
    nbEquipements: m._count.equipements,
  }));
}

export async function setModeleEligibilite(id: string, eligibleExport: boolean): Promise<void> {
  await prisma.modeleEquipement.update({ where: { id }, data: { eligibleExport } });
}

export async function creerModele(libelle: string, marque: string): Promise<void> {
  await prisma.modeleEquipement.create({
    data: {
      libelle,
      marque,
      eligibleExport: marque.trim().toLowerCase() === "yealink",
      alias: [],
    },
  });
}

// ---------------------------------------------------------------- Listes déroulantes

export interface ValeurListe {
  id: string;
  valeur: string;
  ordre: number;
  actif: boolean;
  utilisee: boolean;
}

// Catégories et le champ qui les référence, pour savoir si une valeur est utilisée
// (SPEC §8: une valeur utilisée ne se supprime pas, elle se désactive).
const USAGE: Record<CategorieListe, { table: "client" | "numero"; champ: string } | null> = {
  HEBERGEUR: { table: "client", champ: "hebergeurCible" },
  STATUT_BASCULE: { table: "numero", champ: "statutBascule" },
  STATUT_ETAPE: null, // vérifié via SuiviEtape séparément
  SCENARIO: { table: "client", champ: "scenario" },
  TYPE_INTERVENTION: { table: "client", champ: "typeIntervention" },
  STATUT_MONDAY: { table: "client", champ: "statutMonday" },
  TECHNO_LIEN: { table: "client", champ: "technoLien" },
};

async function valeurEstUtilisee(categorie: CategorieListe, valeur: string): Promise<boolean> {
  if (categorie === "STATUT_ETAPE") {
    return (await prisma.suiviEtape.count({ where: { statut: valeur } })) > 0;
  }
  if (categorie === "HEBERGEUR") {
    const cible = await prisma.client.count({ where: { hebergeurCible: valeur } });
    const source = await prisma.client.count({ where: { hebergeurSource: valeur } });
    return cible + source > 0;
  }
  const usage = USAGE[categorie];
  if (!usage) return false;
  if (usage.table === "numero") {
    return (await prisma.numero.count({ where: { [usage.champ]: valeur } })) > 0;
  }
  return (await prisma.client.count({ where: { [usage.champ]: valeur } })) > 0;
}

export async function fetchListesValeurs(): Promise<Record<string, ValeurListe[]>> {
  const valeurs = await prisma.listeValeur.findMany({
    orderBy: [{ categorie: "asc" }, { ordre: "asc" }],
  });
  const groupe: Record<string, ValeurListe[]> = {};
  for (const v of valeurs) {
    const utilisee = await valeurEstUtilisee(v.categorie, v.valeur);
    (groupe[v.categorie] ??= []).push({
      id: v.id,
      valeur: v.valeur,
      ordre: v.ordre,
      actif: v.actif,
      utilisee,
    });
  }
  return groupe;
}

export async function ajouterValeur(categorie: CategorieListe, valeur: string): Promise<void> {
  const max = await prisma.listeValeur.aggregate({
    where: { categorie },
    _max: { ordre: true },
  });
  await prisma.listeValeur.create({
    data: { categorie, valeur, ordre: (max._max.ordre ?? -1) + 1 },
  });
}

export async function setValeurActif(id: string, actif: boolean): Promise<void> {
  await prisma.listeValeur.update({ where: { id }, data: { actif } });
}

export async function supprimerValeur(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const valeur = await prisma.listeValeur.findUnique({ where: { id } });
  if (!valeur) return { success: false, error: "Valeur introuvable." };
  if (await valeurEstUtilisee(valeur.categorie, valeur.valeur)) {
    return {
      success: false,
      error: "Valeur utilisée par au moins un enregistrement : désactivez-la plutôt.",
    };
  }
  await prisma.listeValeur.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------- Étapes de suivi

export interface EtapeLigne {
  id: string;
  libelle: string;
  ordre: number;
  actif: boolean;
}

export async function fetchEtapes(): Promise<EtapeLigne[]> {
  const etapes = await prisma.etapeModele.findMany({ orderBy: { ordre: "asc" } });
  return etapes.map((e) => ({ id: e.id, libelle: e.libelle, ordre: e.ordre, actif: e.actif }));
}

export async function ajouterEtape(libelle: string): Promise<void> {
  const max = await prisma.etapeModele.aggregate({ _max: { ordre: true } });
  await prisma.etapeModele.create({ data: { libelle, ordre: (max._max.ordre ?? -1) + 1 } });
}

export async function renommerEtape(id: string, libelle: string): Promise<void> {
  await prisma.etapeModele.update({ where: { id }, data: { libelle } });
}

export async function setEtapeActif(id: string, actif: boolean): Promise<void> {
  await prisma.etapeModele.update({ where: { id }, data: { actif } });
}

export async function deplacerEtape(id: string, direction: "haut" | "bas"): Promise<void> {
  const etapes = await prisma.etapeModele.findMany({ orderBy: { ordre: "asc" } });
  const index = etapes.findIndex((e) => e.id === id);
  if (index === -1) return;
  const cible = direction === "haut" ? index - 1 : index + 1;
  if (cible < 0 || cible >= etapes.length) return;
  await prisma.$transaction([
    prisma.etapeModele.update({ where: { id: etapes[index].id }, data: { ordre: etapes[cible].ordre } }),
    prisma.etapeModele.update({ where: { id: etapes[cible].id }, data: { ordre: etapes[index].ordre } }),
  ]);
}

// ---------------------------------------------------------------- Étapes de migration

export interface EtapeMigrationLigne {
  id: string;
  libelle: string;
  ordre: number;
  couleur: string;
  estBloquant: boolean;
  actif: boolean;
  utilisee: boolean;
}

export async function fetchEtapesMigrationParam(): Promise<EtapeMigrationLigne[]> {
  const etapes = await prisma.etapeMigration.findMany({
    orderBy: { ordre: "asc" },
    include: { _count: { select: { clients: true } } },
  });
  return etapes.map((e) => ({
    id: e.id,
    libelle: e.libelle,
    ordre: e.ordre,
    couleur: e.couleur,
    estBloquant: e.estBloquant,
    actif: e.actif,
    utilisee: e._count.clients > 0,
  }));
}

export async function ajouterEtapeMigration(libelle: string): Promise<void> {
  const max = await prisma.etapeMigration.aggregate({ _max: { ordre: true } });
  await prisma.etapeMigration.create({ data: { libelle, ordre: (max._max.ordre ?? -1) + 1 } });
}

export async function renommerEtapeMigration(id: string, libelle: string): Promise<void> {
  await prisma.etapeMigration.update({ where: { id }, data: { libelle } });
}

export async function setCouleurEtapeMigration(id: string, couleur: string): Promise<void> {
  await prisma.etapeMigration.update({ where: { id }, data: { couleur } });
}

export async function setEtapeMigrationBloquant(id: string, estBloquant: boolean): Promise<void> {
  await prisma.etapeMigration.update({ where: { id }, data: { estBloquant } });
}

export async function setEtapeMigrationActif(id: string, actif: boolean): Promise<void> {
  await prisma.etapeMigration.update({ where: { id }, data: { actif } });
}

export async function deplacerEtapeMigration(
  id: string,
  direction: "haut" | "bas"
): Promise<void> {
  const etapes = await prisma.etapeMigration.findMany({ orderBy: { ordre: "asc" } });
  const index = etapes.findIndex((e) => e.id === id);
  if (index === -1) return;
  const cible = direction === "haut" ? index - 1 : index + 1;
  if (cible < 0 || cible >= etapes.length) return;
  await prisma.$transaction([
    prisma.etapeMigration.update({ where: { id: etapes[index].id }, data: { ordre: etapes[cible].ordre } }),
    prisma.etapeMigration.update({ where: { id: etapes[cible].id }, data: { ordre: etapes[index].ordre } }),
  ]);
}

// Une étape utilisée par au moins un client ne peut être supprimée, seulement désactivée.
export async function supprimerEtapeMigration(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const nb = await prisma.client.count({ where: { etapeMigrationId: id } });
  if (nb > 0) {
    return { success: false, error: "Étape utilisée par des clients : désactivez-la plutôt." };
  }
  await prisma.etapeMigration.delete({ where: { id } });
  return { success: true };
}

// ---------------------------------------------------------------- Comptes

export interface CompteLigne {
  id: string;
  email: string;
  nom: string;
  role: string;
  actif: boolean;
}

export async function fetchComptes(): Promise<CompteLigne[]> {
  const comptes = await prisma.utilisateurApp.findMany({ orderBy: { email: "asc" } });
  return comptes.map((c) => ({
    id: c.id,
    email: c.email,
    nom: c.nom,
    role: c.role,
    actif: c.actif,
  }));
}

export async function creerCompte(
  email: string,
  nom: string,
  role: "ADMIN" | "OPERATEUR",
  motDePasse: string
): Promise<void> {
  const hash = await bcrypt.hash(motDePasse, 10);
  await prisma.utilisateurApp.create({ data: { email, nom, role, motDePasse: hash } });
}

export async function setCompteActif(id: string, actif: boolean): Promise<void> {
  await prisma.utilisateurApp.update({ where: { id }, data: { actif } });
}

export async function resetMotDePasse(id: string, motDePasse: string): Promise<void> {
  const hash = await bcrypt.hash(motDePasse, 10);
  await prisma.utilisateurApp.update({ where: { id }, data: { motDePasse: hash } });
}

// ---------------------------------------------------------------- Contrôle global & sync

export async function recalculerControleGlobal(): Promise<number> {
  const numeros = await prisma.numero.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    select: { id: true },
  });
  for (const n of numeros) {
    await recalculerControle(n.id);
  }
  return numeros.length;
}

export async function fetchSyncRuns(limit = 10) {
  return prisma.sheetSyncRun.findMany({
    include: { auteur: { select: { email: true } } },
    orderBy: { creeLe: "desc" },
    take: limit,
  });
}

// --- Checklist chef de projet (étapes au niveau dossier) ---

export interface EtapeProjetLigne {
  id: string;
  libelle: string;
  phase: string;
  aide: string | null;
  ordre: number;
  actif: boolean;
}

export async function fetchEtapesProjetParam(): Promise<EtapeProjetLigne[]> {
  const etapes = await prisma.etapeProjet.findMany({ orderBy: { ordre: "asc" } });
  return etapes.map((e) => ({
    id: e.id,
    libelle: e.libelle,
    phase: e.phase,
    aide: e.aide,
    ordre: e.ordre,
    actif: e.actif,
  }));
}

export async function updateEtapeProjet(
  id: string,
  data: { libelle?: string; phase?: string; aide?: string; actif?: boolean }
): Promise<void> {
  await prisma.etapeProjet.update({
    where: { id },
    data: { ...data, ...(data.aide !== undefined ? { aide: data.aide.trim() || null } : {}) },
  });
}

export async function ajouterEtapeProjet(libelle: string, phase: string): Promise<void> {
  const max = await prisma.etapeProjet.aggregate({ _max: { ordre: true } });
  await prisma.etapeProjet.create({
    data: { libelle, phase, ordre: (max._max.ordre ?? 0) + 10 },
  });
}

export async function supprimerEtapeProjet(id: string): Promise<void> {
  await prisma.etapeProjet.delete({ where: { id } });
}

// Nom d'affichage des comptes, indexé par email : les attributions sont stockées par email
// (identifiant stable), mais on montre partout le nom saisi à la création du compte.
export async function fetchNomsComptes(): Promise<Record<string, string>> {
  const comptes = await prisma.utilisateurApp.findMany({ select: { email: true, nom: true } });
  return Object.fromEntries(comptes.map((c) => [c.email, c.nom]));
}
