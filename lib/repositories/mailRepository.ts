import type { TypeMail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { VariablesMail } from "@/lib/domain/mail/substitution";

export interface ModeleMailLite {
  id: string;
  scenario: string;
  type: TypeMail;
  objet: string;
  corps: string;
}

// Templates actifs (pour le sélecteur de la fiche client), ordonnés.
export async function listModelesMail(): Promise<ModeleMailLite[]> {
  const modeles = await prisma.modeleMail.findMany({
    where: { actif: true },
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
  },
  date: string,
  creneau: string
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
  };
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
    include: { auteur: { select: { email: true } } },
    orderBy: { creeLe: "desc" },
    take: 30,
  });
}

// --- Paramètres (édition des templates) ---

export interface ModeleMailLigne extends ModeleMailLite {
  actif: boolean;
  ordre: number;
}

export async function fetchModelesMailParam(): Promise<ModeleMailLigne[]> {
  const modeles = await prisma.modeleMail.findMany({
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
  corps: string
): Promise<void> {
  const max = await prisma.modeleMail.aggregate({ _max: { ordre: true } });
  await prisma.modeleMail.create({
    data: { scenario, type, objet, corps, ordre: (max._max.ordre ?? -1) + 1 },
  });
}

export async function supprimerModeleMail(id: string): Promise<void> {
  await prisma.modeleMail.delete({ where: { id } });
}
