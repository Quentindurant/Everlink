import type { TypeMail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contactSite, type VariablesMail } from "@/lib/domain/mail/substitution";
import { filtrePartenaire, idPartenaireActif } from "@/lib/partenaire";

export interface ModeleMailLite {
  id: string;
  scenario: string;
  type: TypeMail;
  objet: string;
  corps: string;
}

// Templates actifs (pour le sélecteur de la fiche client), ordonnés. La fiche passe le
// partenaire du client : un dossier INOVACOM ouvert depuis un lien direct alors que le
// sélecteur est sur EVERLINK doit quand même proposer les modèles INOVACOM.
export async function listModelesMail(partenaireId?: string | null): Promise<ModeleMailLite[]> {
  const modeles = await prisma.modeleMail.findMany({
    where: { actif: true, ...filtrePartenaire(partenaireId ?? (await idPartenaireActif())) },
    orderBy: [{ ordre: "asc" }, { scenario: "asc" }],
    select: { id: true, scenario: true, type: true, objet: true, corps: true },
  });
  return modeles;
}

// Construit les variables de substitution depuis un client. La date/créneau sont fournis à
// l'envoi (ou repris des champs du client). numero_gc vient de l'environnement.
export function buildVariablesClient(
  client: {
    raisonSociale: string;
    filiale: string | null;
    adresse: string | null;
    contactCivilite?: string | null;
    contactNom: string | null;
    contactPrenom: string | null;
    contactFixe?: string | null;
    contactMobile?: string | null;
  },
  date: string,
  creneau: string,
  mailMigration = ""
): VariablesMail {
  const civiliteNom = [client.contactPrenom, client.contactNom].filter(Boolean).join(" ").trim();
  return {
    civilite_nom: civiliteNom || "Madame, Monsieur",
    nom_client: client.raisonSociale,
    filiale: client.filiale ?? "",
    adresse: client.adresse ?? "",
    date,
    creneau,
    numero_gc: process.env.NUMERO_GC ?? "",
    mail_migration: mailMigration,
    contact_site: contactSite(client),
  };
}


// Utilisateurs équipés d'un softphone (DOKO à migrer vers Speek) : pilote le paragraphe de
// préparation dans la prévenance et les guides joints à la confirmation.
export async function compterSoftphones(clientId: string): Promise<number> {
  return prisma.utilisateur.count({
    where: {
      clientId,
      archiveA: null,
      equipements: { some: { archiveA: null, modele: { type: "SOFTPHONE" } } },
    },
  });
}

// --- Réglages d'envoi du partenaire (copie, expéditeur, signature, téléphone) ---

export interface PartenaireEnvoi {
  id: string;
  code: string;
  nom: string;
  logo: string;
  site: string | null;
  mailMigration: string | null;
  copieMail: string | null;
  expediteur: string | null;
  telephone: string | null;
  signatureLignes: string | null;
}

const CHAMPS_ENVOI = {
  id: true,
  code: true,
  nom: true,
  logo: true,
  site: true,
  mailMigration: true,
  copieMail: true,
  expediteur: true,
  telephone: true,
  signatureLignes: true,
} as const;

export async function fetchPartenaireEnvoi(id: string | null | undefined): Promise<PartenaireEnvoi | null> {
  if (!id) return null;
  return prisma.partenaire.findUnique({ where: { id }, select: CHAMPS_ENVOI });
}

// Partenaire du dossier, pour signer et adresser un envoi en son nom.
export async function fetchPartenaireEnvoiDuClient(clientId: string): Promise<PartenaireEnvoi | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { partenaire: { select: CHAMPS_ENVOI } },
  });
  return client?.partenaire ?? null;
}

/** Champs d'envoi éditables depuis Paramètres. */
export type ChampEnvoi = "copieMail" | "expediteur" | "mailMigration" | "telephone" | "signatureLignes" | "site";

export async function updatePartenaireEnvoi(id: string, champ: ChampEnvoi, valeur: string | null): Promise<void> {
  await prisma.partenaire.update({ where: { id }, data: { [champ]: valeur } });
}

// --- Paramètres applicatifs (signature, copie systématique) ---

export async function getParametreApp(cle: string): Promise<string | null> {
  const p = await prisma.parametreApp.findUnique({ where: { cle } });
  return p?.valeur ?? null;
}

export async function setParametreApp(cle: string, valeur: string): Promise<void> {
  await prisma.parametreApp.upsert({
    where: { cle },
    update: { valeur },
    create: { cle, valeur },
  });
}

export async function enregistrerEnvoi(data: {
  clientId: string;
  type: TypeMail;
  destinataire: string;
  objet: string;
  corps: string;
  succes: boolean;
  erreur?: string;
  auteurId?: string | null;
  mailjetCustomId?: string | null;
}): Promise<void> {
  await prisma.mailEnvoi.create({ data: { ...data, erreur: data.erreur ?? null } });
}

export async function fetchEnvois(clientId: string) {
  return prisma.mailEnvoi.findMany({
    where: { clientId },
    include: { auteur: { select: { email: true, nom: true } } },
    orderBy: { creeLe: "desc" },
    take: 30,
  });
}

// --- Paramètres (édition des templates) ---

export interface ModeleMailLigne extends ModeleMailLite {
  actif: boolean;
  ordre: number;
}

// Modèles du partenaire actif seulement : sans filtre, l'écran mélangeait les modèles des deux
// partenaires sans dire à qui chacun appartient.
export async function fetchModelesMailParam(partenaireId: string | null): Promise<ModeleMailLigne[]> {
  const modeles = await prisma.modeleMail.findMany({
    where: filtrePartenaire(partenaireId),
    orderBy: [{ ordre: "asc" }, { scenario: "asc" }],
  });
  return modeles.map((m) => ({
    id: m.id,
    scenario: m.scenario,
    type: m.type,
    objet: m.objet,
    corps: m.corps,
    actif: m.actif,
    ordre: m.ordre,
  }));
}

export async function updateModeleMail(
  id: string,
  data: { scenario?: string; objet?: string; corps?: string; actif?: boolean }
): Promise<void> {
  await prisma.modeleMail.update({ where: { id }, data });
}

export async function creerModeleMail(
  scenario: string,
  type: TypeMail,
  objet: string,
  corps: string,
  partenaireId: string | null
): Promise<void> {
  // Rattaché au partenaire : un modèle sans partenaire n'apparaîtrait nulle part.
  const max = await prisma.modeleMail.aggregate({
    where: filtrePartenaire(partenaireId),
    _max: { ordre: true },
  });
  await prisma.modeleMail.create({
    data: { scenario, type, objet, corps, ordre: (max._max.ordre ?? -1) + 1, partenaireId },
  });
}

export async function supprimerModeleMail(id: string): Promise<void> {
  await prisma.modeleMail.delete({ where: { id } });
}
