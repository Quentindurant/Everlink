"use server";

// Vue live et synchronisation du tableau de suivi maison (remplace le Zoho Sheet). Les
// noms des actions sont conservés (rafraichirZohoAction, synchroniserDepuisZohoAction)
// pour ne pas toucher les composants appelants ; les formes retournées sont identiques.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { LigneSuivi } from "@/lib/domain/suivi/ligneSuivi";
import { lireVueSuivi } from "@/lib/suivi/vueSuivi";
import { runSuiviPull, type SuiviPullResultat } from "@/lib/suivi/syncDepuisSuivi";
import { journaliser } from "@/lib/activite";
import { prisma } from "@/lib/prisma";
import { parseDateSheet, rapprocherLignes } from "@/lib/domain/zoho/rapprochement";
import { filtrePartenaire, idPartenaireActif } from "@/lib/partenaire";

export async function rafraichirZohoAction(): Promise<{
  configure: boolean;
  onglet: string;
  lignes: LigneSuivi[];
}> {
  const session = await auth();
  if (!session?.user) return { configure: false, onglet: "", lignes: [] };
  return lireVueSuivi();
}

// Synchronise le tableau vers l'app (statut, date, heure, technicien des dossiers rapprochés).
export async function synchroniserDepuisZohoAction(): Promise<SuiviPullResultat> {
  const session = await auth();
  if (!session?.user) {
    return {
      succes: false, onglet: "", lignesSheet: 0, rapproches: 0, misAJour: 0,
      lignesInconnues: [], message: "Non authentifié.",
    };
  }
  const r = await runSuiviPull();
  if (r.succes && r.misAJour > 0) {
    await journaliser("Suivi", "tableau", "Sync tableau → app", `${r.misAJour} dossier(s)`);
  }
  revalidatePath("/techniciens");
  revalidatePath("/clients");
  return r;
}

// ------------------------------------------------- Rapprochement manuel

export interface LigneOrpheline {
  nomSheet: string;
  statut: string;
  date: string;
  tech: string;
  /** Département de l'intervention : c'est lui qui distingue ANNECY de PARIS à l'œil. */
  dpt: string;
}

export interface DossierOrphelin {
  id: string;
  raisonSociale: string;
}

export interface RapprochementManquant {
  configure: boolean;
  lignes: LigneOrpheline[];
  dossiers: DossierOrphelin[];
}

/**
 * Ce que la synchronisation automatique ne peut pas relier. Deux noms qu'aucune règle ne
 * doit assimiler — « STEPHENSON - BOULOGNE » côté app, « - ODESEINE » côté tableau — laissent
 * un dossier figé sur un statut périmé sans que personne le voie. On les met donc en face
 * l'un de l'autre pour qu'un ADV tranche une fois pour toutes.
 */
export async function fetchRapprochementManquant(): Promise<RapprochementManquant> {
  const session = await auth();
  if (!session?.user) return { configure: false, lignes: [], dossiers: [] };

  const vue = await lireVueSuivi();
  if (!vue.configure) return { configure: false, lignes: [], dossiers: [] };

  const pid = await idPartenaireActif();
  const clients = await prisma.client.findMany({
    where: { archiveA: null, ...filtrePartenaire(pid) },
    select: { id: true, raisonSociale: true, zohoNomSheet: true, departement: true },
    orderBy: { raisonSociale: "asc" },
  });

  const { apparies, lignesInconnues } = rapprocherLignes(
    vue.lignes.map((l) => ({
      client: l.client,
      dpt: l.dpt,
      date: l.date,
      heure: l.heure,
      nomTech: l.nomTech,
      nomCp: l.nomCp,
      installation: l.installation,
    })),
    clients
  );
  const apparieIds = new Set(apparies.map((a) => a.clientId));
  const parNom = new Map(vue.lignes.map((l) => [l.client, l]));

  return {
    configure: true,
    lignes: lignesInconnues.map((nom) => ({
      nomSheet: nom,
      statut: parNom.get(nom)?.installation ?? "",
      date: parNom.get(nom)?.date ?? "",
      tech: parNom.get(nom)?.nomTech ?? "",
      dpt: parNom.get(nom)?.dpt ?? "",
    })),
    dossiers: clients
      .filter((c) => !apparieIds.has(c.id))
      .map((c) => ({ id: c.id, raisonSociale: c.raisonSociale })),
  };
}

/**
 * Mémorise le nom du tableau pour ce dossier, puis synchronise dans la foulée. Le lien vaut
 * pour toutes les synchronisations suivantes : le rapprochement mémorisé passe avant toute
 * comparaison de noms.
 */
export async function lierDossierAuTableauAction(
  clientId: string,
  nomSheet: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const nom = nomSheet.trim();
  if (!nom) return { success: false, error: "Ligne du tableau manquante." };

  // Un même nom de tableau ne peut pas désigner deux dossiers : le second écraserait le
  // premier à chaque synchronisation, en silence.
  const deja = await prisma.client.findFirst({
    where: { zohoNomSheet: nom, NOT: { id: clientId }, archiveA: null },
    select: { raisonSociale: true },
  });
  if (deja) {
    return { success: false, error: `Cette ligne est déjà liée à ${deja.raisonSociale}.` };
  }

  await prisma.client.update({ where: { id: clientId }, data: { zohoNomSheet: nom } });
  await journaliser("Client", clientId, "Rapprochement manuel", nom);
  await runSuiviPull();
  revalidatePath("/techniciens");
  revalidatePath("/clients");
  return { success: true };
}

/** "S31- GUIDET ET ASSOCIES PARIS" → "GUIDET ET ASSOCIES PARIS" : la semaine de pose n'est
 * pas une partie du nom du client. La casse d'origine est conservée. */
function raisonSocialeDepuisLigne(nomSheet: string): string {
  return nomSheet.replace(/^S\d+\s*-\s*/i, "").replace(/\s+/g, " ").trim();
}

/**
 * Crée un dossier à partir d'une ligne du tableau qui n'en avait aucun.
 *
 * Deux agences d'un même cabinet — GUIDET ET ASSOCIES PARIS et ANNECY — migrent ensemble
 * mais doivent se suivre séparément : chacune a ses postes, ses étapes et sa date. Les
 * fusionner en un dossier fait perdre la trace de ce qui a été fait pour laquelle.
 *
 * Le dossier naît rattaché à sa ligne : le nom du tableau est mémorisé d'emblée, donc la
 * synchronisation le reconnaîtra sans jamais repasser par une comparaison de noms.
 */
export async function creerDossierDepuisLigneAction(
  nomSheet: string
): Promise<{ success: boolean; error?: string; clientId?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const nom = nomSheet.trim();
  if (!nom) return { success: false, error: "Ligne du tableau manquante." };

  const vue = await lireVueSuivi();
  const ligne = vue.lignes.find((l) => l.client === nom);
  if (!ligne) {
    return { success: false, error: "Ligne introuvable : actualisez le tableau." };
  }

  const raisonSociale = raisonSocialeDepuisLigne(nom);
  if (!raisonSociale) return { success: false, error: "Nom de client vide dans le tableau." };

  // raisonSociale est unique : un homonyme signale soit un doublon, soit un dossier qu'il
  // faut lier plutôt que recréer.
  const homonyme = await prisma.client.findFirst({
    where: { raisonSociale, archiveA: null },
    select: { id: true },
  });
  if (homonyme) {
    return {
      success: false,
      error: `Un dossier « ${raisonSociale} » existe déjà : utilisez « Lier » plutôt que de le recréer.`,
    };
  }

  const cree = await prisma.client.create({
    data: {
      raisonSociale,
      cleRapprochement: raisonSociale.toUpperCase(),
      departement: ligne.dpt.trim() || null,
      // Le dossier naît déjà lié à sa ligne : plus aucune comparaison de noms nécessaire.
      zohoNomSheet: nom,
      statutSuivi: ligne.installation.trim() || null,
      dateIntervention: parseDateSheet(ligne.date),
      creneauIntervention: ligne.heure.trim() || null,
      // La vue du tableau est déjà bornée au partenaire affiché : le dossier naît du bon côté.
      partenaireId: await idPartenaireActif(),
    },
    select: { id: true },
  });

  await journaliser("Client", cree.id, "Dossier créé depuis le tableau", nom);
  revalidatePath("/techniciens");
  revalidatePath("/clients");
  return { success: true, clientId: cree.id };
}
