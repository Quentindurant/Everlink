"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  importStock,
  parseStockWorkbook,
  previewStock,
  type ArticleStockRow,
  type ImportStockResultat,
  type StockPreviewRow,
} from "@/lib/repositories/importStockRepository";
import { STATUT_SUIVANT } from "@/lib/repositories/stockRepository";
import { numeroSuiviValidePour, transporteurAvecSuiviApi } from "@/lib/domain/tracking/laposte";
import { suivreColis } from "@/lib/tracking/laPosteClient";
import { journaliser } from "@/lib/activite";
import { parseMikrotikRsc } from "@/lib/domain/routeur/mikrotik";
import {
  cloreLot,
  cocherReceptionOnt,
  creerOnt,
  modifierOnt,
  retirerDuLot,
  supprimerOnt,
  verserDansLot,
} from "@/lib/repositories/ontRepository";

async function garde() {
  const session = await auth();
  return !!session?.user;
}

export async function previsualiserStockAction(
  formData: FormData
): Promise<
  { success: true; rows: StockPreviewRow[]; ignores: number } | { success: false; error: string }
> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  const buffer = Buffer.from(await fichier.arrayBuffer());
  const { rows, ignores } = await parseStockWorkbook(buffer);
  if (rows.length === 0) return { success: false, error: "Aucun article détecté dans le fichier." };
  return { success: true, rows: await previewStock(rows), ignores };
}

export async function validerStockAction(
  rows: ArticleStockRow[]
): Promise<{ success: true; resultat: ImportStockResultat } | { success: false; error: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  try {
    const resultat = await importStock(rows);
    revalidatePath("/staging", "layout");
    return { success: true, resultat };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'import." };
  }
}

// Fait avancer un article dans le cycle En stock → Configuré → Envoyé → Installé, en horodatant
// l'envoi et l'installation au passage.
export async function avancerStatutAction(id: string): Promise<void> {
  if (!(await garde())) return;
  const article = await prisma.articleStock.findUnique({ where: { id }, select: { statut: true } });
  if (!article) return;
  const suivant = STATUT_SUIVANT[article.statut];
  if (!suivant) return;
  await prisma.articleStock.update({
    where: { id },
    data: {
      statut: suivant,
      ...(suivant === "ENVOYE" ? { dateEnvoi: new Date() } : {}),
      ...(suivant === "INSTALLE" ? { dateInstallation: new Date() } : {}),
    },
  });
  revalidatePath("/staging", "layout");
}

// Expédie un article : le passe en « Envoyé », enregistre le transporteur (défaut Chronopost)
// et le numéro de suivi, puis tente un premier relevé d'état (le cron rafraîchira ensuite).
export async function expedierAvecSuiviAction(
  id: string,
  transporteur: string,
  numeroSuivi: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const num = numeroSuivi.trim();
  if (num && !numeroSuiviValidePour(transporteur, num)) {
    return { success: false, error: "Numéro de suivi invalide pour ce transporteur." };
  }
  // Relevé temps réel uniquement pour les transporteurs couverts par l'API La Poste.
  const etat = num && transporteurAvecSuiviApi(transporteur) ? await suivreColis(num) : null;
  await prisma.articleStock.update({
    where: { id },
    data: {
      statut: "ENVOYE",
      dateEnvoi: new Date(),
      transporteur: transporteur.trim() || "Chronopost",
      numeroSuivi: num || null,
      suiviStatut: etat?.statut ?? null,
      suiviLibelle: etat?.libelle ?? null,
      suiviEtape: etat?.etape ?? null,
      suiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: num ? new Date() : null,
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Expédie un lot d'articles dans un même colis : tous passent en « Envoyé » avec le même
// transporteur, numéro de suivi et client destinataire. Un premier état de suivi est relevé.
export async function expedierLotAction(
  ids: string[],
  transporteur: string,
  numeroSuivi: string,
  clientNom: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  if (ids.length === 0) return { success: false, error: "Aucun article sélectionné." };
  const num = numeroSuivi.trim();
  if (num && !numeroSuiviValidePour(transporteur, num)) {
    return { success: false, error: "Numéro de suivi invalide pour ce transporteur." };
  }
  const nom = clientNom.trim();
  const client = nom
    ? await prisma.client.findFirst({
        where: { archiveA: null, raisonSociale: { equals: nom, mode: "insensitive" } },
        select: { id: true },
      })
    : null;
  const etat = num && transporteurAvecSuiviApi(transporteur) ? await suivreColis(num) : null;
  await prisma.articleStock.updateMany({
    where: { id: { in: ids } },
    data: {
      statut: "ENVOYE",
      dateEnvoi: new Date(),
      transporteur: transporteur.trim() || "Chronopost",
      numeroSuivi: num || null,
      clientId: client?.id ?? null,
      clientFinalTexte: nom || null,
      suiviStatut: etat?.statut ?? null,
      suiviLibelle: etat?.libelle ?? null,
      suiviEtape: etat?.etape ?? null,
      suiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: num ? new Date() : null,
    },
  });
  await journaliser("ArticleStock", ids[0], "Expédition", `${ids.length} article(s)${num ? ` · ${num}` : ""}`);
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Relève l'état du colis à la demande (bouton actualiser de l'historique) : interroge
// l'API La Poste tout de suite au lieu d'attendre le prochain passage du cron.
export async function rafraichirSuiviColisAction(
  ids: string[],
  numeroSuivi: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const num = numeroSuivi.trim();
  if (ids.length === 0 || !num) return { success: false, error: "Aucun colis." };
  const etat = await suivreColis(num);
  if (!etat) return { success: false, error: "Suivi indisponible (API La Poste)." };
  await prisma.articleStock.updateMany({
    where: { id: { in: ids } },
    data: {
      suiviStatut: etat.statut,
      suiviLibelle: etat.libelle,
      suiviEtape: etat.etape,
      suiviLivreLe: etat.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: new Date(),
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Annule une expédition faite par erreur : les articles reviennent « En stock », l'envoi et
// le suivi sont effacés. Le rattachement client est conservé (l'erreur porte sur le colis,
// pas sur le dossier).
export async function annulerExpeditionAction(ids: string[]): Promise<void> {
  if (!(await garde())) return;
  if (ids.length === 0) return;
  await prisma.articleStock.updateMany({
    where: { id: { in: ids }, statut: "ENVOYE" },
    data: {
      statut: "EN_STOCK",
      dateEnvoi: null,
      transporteur: null,
      numeroSuivi: null,
      suiviStatut: null,
      suiviLibelle: null,
      suiviEtape: null,
      suiviLivreLe: null,
      suiviMajLe: null,
    },
  });
  await journaliser("ArticleStock", ids[0], "Annulation expédition", `${ids.length} article(s)`);
  revalidatePath("/staging", "layout");
}

// Corrige un colis déjà expédié : transporteur, numéro de suivi et destinataire, sur tous
// les articles du colis. Le suivi est relevé à nouveau avec le numéro corrigé.
export async function corrigerColisAction(
  ids: string[],
  transporteur: string,
  numeroSuivi: string,
  clientNom: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  if (ids.length === 0) return { success: false, error: "Aucun article." };
  const num = numeroSuivi.trim();
  if (num && !numeroSuiviValidePour(transporteur, num)) {
    return { success: false, error: "Numéro de suivi invalide pour ce transporteur." };
  }
  const nom = clientNom.trim();
  const client = nom
    ? await prisma.client.findFirst({
        where: { archiveA: null, raisonSociale: { equals: nom, mode: "insensitive" } },
        select: { id: true },
      })
    : null;
  const etat = num && transporteurAvecSuiviApi(transporteur) ? await suivreColis(num) : null;
  await prisma.articleStock.updateMany({
    where: { id: { in: ids } },
    data: {
      transporteur: transporteur.trim() || "Chronopost",
      numeroSuivi: num || null,
      clientId: client?.id ?? null,
      clientFinalTexte: nom || null,
      suiviStatut: etat?.statut ?? null,
      suiviLibelle: etat?.libelle ?? null,
      suiviEtape: etat?.etape ?? null,
      suiviLivreLe: etat?.livreLe ? new Date(etat.livreLe) : null,
      suiviMajLe: num ? new Date() : null,
    },
  });
  await journaliser("ArticleStock", ids[0], "Correction colis", `${ids.length} article(s)${num ? ` · ${num}` : ""}`);
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Annule un marquage « installé » cliqué par erreur : l'article redevient « Envoyé ».
export async function annulerInstallationAction(id: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.articleStock.updateMany({
    where: { id, statut: "INSTALLE" },
    data: { statut: "ENVOYE", dateInstallation: null },
  });
  revalidatePath("/staging", "layout");
}

// Rattache un article à un client. Si le nom correspond exactement à une fiche client active,
// on stocke l'ID (ce qui débloque les liens/intervention dans « À installer »); sinon on garde
// juste le texte libre.
export async function rattacherClientAction(id: string, nom: string): Promise<void> {
  if (!(await garde())) return;
  const t = nom.trim();
  if (!t) {
    await prisma.articleStock.update({ where: { id }, data: { clientId: null, clientFinalTexte: null } });
    revalidatePath("/staging", "layout");
    return;
  }
  const client = await prisma.client.findFirst({
    where: { archiveA: null, raisonSociale: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  await prisma.articleStock.update({
    where: { id },
    data: client
      ? { clientId: client.id, clientFinalTexte: t }
      : { clientId: null, clientFinalTexte: t },
  });
  revalidatePath("/staging", "layout");
}

// Ajoute un article saisi à la main (ou à la douchette) : entre en stock daté du jour.
// Un article actif portant le même numéro de série est refusé (pas de doublon silencieux).
export async function ajouterArticleAction(
  type: string,
  numeroSerie: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const serie = numeroSerie.trim();
  if (!serie) return { success: false, error: "Numéro de série requis." };
  const existant = await prisma.articleStock.findFirst({
    where: { archiveA: null, numeroSerie: { equals: serie, mode: "insensitive" } },
    select: { statut: true },
  });
  if (existant) {
    return { success: false, error: `${serie} déjà présent (${existant.statut}).` };
  }
  const cree = await prisma.articleStock.create({
    data: {
      type: type.trim() || "Routeur 4G seul",
      numeroSerie: serie,
      statut: "EN_STOCK",
      dateReception: new Date(),
    },
  });
  await journaliser("ArticleStock", cree.id, "Réception matériel", serie);
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Édite un champ d'un article (type, numéro de série ou commentaire).
export async function updateArticleAction(
  id: string,
  champ: "type" | "numeroSerie" | "commentaire",
  valeur: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const v = valeur.trim();
  if (champ !== "commentaire" && !v) return { success: false, error: "Valeur requise." };
  await prisma.articleStock.update({
    where: { id },
    data: { [champ]: champ === "commentaire" ? v || null : v },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Enregistre le routeur récupéré chez le client le jour de l'installation (origine CLIENT).
export async function ajouterRetourAction(
  type: string,
  numeroSerie: string,
  clientFinal: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  if (!numeroSerie.trim()) return { success: false, error: "Numéro de série requis." };
  await prisma.articleStock.create({
    data: {
      type: type.trim() || "Routeur client",
      numeroSerie: numeroSerie.trim(),
      statut: "RETOUR",
      origine: "CLIENT",
      clientFinalTexte: clientFinal.trim() || null,
    },
  });
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Importe l'export .rsc d'un routeur Sewan, le parse et le rattache à un client : le staging
// retrouve LAN/DHCP, WiFi et NAT/DMZ pour reproduire la configuration côté UNYC.
export async function importerConfigRouteurAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const fichier = formData.get("fichier");
  const clientNom = String(formData.get("client") ?? "").trim();
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { success: false, error: "Aucun fichier fourni." };
  }
  const texte = await fichier.text();
  const donnees = parseMikrotikRsc(texte);
  if (!donnees.lanAdresse && donnees.wifi.length === 0 && donnees.nat.length === 0) {
    return { success: false, error: "Rien d'exploitable dans ce fichier (.rsc MikroTik attendu)." };
  }
  const client = clientNom
    ? await prisma.client.findFirst({
        where: { archiveA: null, raisonSociale: { equals: clientNom, mode: "insensitive" } },
        select: { id: true },
      })
    : null;
  const cree = await prisma.configRouteur.create({
    data: {
      nomFichier: fichier.name,
      clientId: client?.id ?? null,
      clientTexte: clientNom || null,
      donnees: JSON.parse(JSON.stringify(donnees)),
    },
  });
  await journaliser("ConfigRouteur", cree.id, "Import config routeur", clientNom || fichier.name);
  revalidatePath("/staging", "layout");
  return { success: true };
}

// Corrige le client rattaché à une configuration déjà importée (erreur de saisie à l'import).
// Même logique que l'import : ID si la raison sociale correspond à une fiche, texte sinon.
export async function modifierClientConfigRouteurAction(
  id: string,
  nom: string
): Promise<{ success: boolean; error?: string }> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const t = nom.trim();
  if (!t) return { success: false, error: "Nom de client requis." };
  const client = await prisma.client.findFirst({
    where: { archiveA: null, raisonSociale: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  await prisma.configRouteur.update({
    where: { id },
    data: { clientId: client?.id ?? null, clientTexte: t },
  });
  await journaliser("ConfigRouteur", id, "Modification client config routeur", t);
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function supprimerConfigRouteurAction(id: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.configRouteur.delete({ where: { id } });
  revalidatePath("/staging", "layout");
}

export async function supprimerArticleAction(id: string): Promise<void> {
  if (!(await garde())) return;
  await prisma.articleStock.update({ where: { id }, data: { archiveA: new Date() } });
  revalidatePath("/staging", "layout");
}

// ---------------------------------------------------------------- ONT récupérés

/** Les actions ONT rendent l'erreur : le staging doit voir pourquoi un lot refuse de partir. */
type ResultatOnt = { success: boolean; error?: string };

export async function cocherReceptionOntAction(
  id: string,
  recu: boolean
): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  await cocherReceptionOnt(id, recu);
  await journaliser("ArticleStock", id, "Réception ONT", recu ? "reçu" : "annulé");
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function verserDansLotAction(articleId: string): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const r = await verserDansLot(articleId);
  if (!r.ok) return { success: false, error: r.message };
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function retirerDuLotAction(articleId: string): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  await retirerDuLot(articleId);
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function cloreLotAction(champs: {
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const r = await cloreLot(champs);
  if (!r.ok) return { success: false, error: r.message };
  await journaliser("LotRetourOnt", r.lotId, "Lot ONT expédié", champs.destinataire);
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function creerOntAction(champs: {
  numeroSerie: string;
  clientId: string | null;
  recu: boolean;
}): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const r = await creerOnt(champs);
  if (!r.ok) return { success: false, error: r.message };
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function modifierOntAction(
  id: string,
  champs: { numeroSerie: string; clientId: string | null }
): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const r = await modifierOnt(id, champs);
  if (!r.ok) return { success: false, error: r.message };
  await journaliser("ArticleStock", id, "Correction ONT", champs.numeroSerie);
  revalidatePath("/staging", "layout");
  return { success: true };
}

export async function supprimerOntAction(id: string): Promise<ResultatOnt> {
  if (!(await garde())) return { success: false, error: "Non authentifié." };
  const r = await supprimerOnt(id);
  if (!r.ok) return { success: false, error: r.message };
  await journaliser("ArticleStock", id, "Suppression ONT");
  revalidatePath("/staging", "layout");
  return { success: true };
}
