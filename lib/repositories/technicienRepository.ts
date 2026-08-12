import { prisma } from "@/lib/prisma";
import {
  nomsTechOccupes,
  techniciensDisponibles,
  type Affectation,
  type TechnicienLite,
} from "@/lib/domain/technicien/disponibilite";
import { lireAffectationsSheet } from "@/lib/zoho/zohoClient";

export interface TechnicienLigne {
  id: string;
  nom: string;
  prestataireId: string | null;
  prestataireNom: string | null;
  departements: string[];
  actif: boolean;
}

export interface DossierAdv {
  clientId: string;
  raisonSociale: string;
  // Lot de migration : les ADV pilotent lot par lot.
  lotNom: string | null;
  departement: string | null;
  etapeMigrationId: string | null;
  nbTentativesContact: number;
  dernierContactLe: string | null;
  dateIso: string | null;
  creneau: string | null;
  technicienId: string | null;
  technicienNom: string | null;
  avecLien: boolean;
  lienCommande: boolean;
  lienLivre: boolean;
  // Derniers mails envoyés avec succès, par type.
  mailPrevenanceLe: string | null;
  mailConfirmationLe: string | null;
  zohoPousseLe: string | null;
  routeurClientReutilise: boolean;
  // Suivi ADV (colonnes du TABLEAU SUIVI COMMANDES pilotées depuis l'app).
  statutSuivi: string | null;
  dateImperativeIso: string | null;
  materielRecu: string | null;
  numeroChrono: string | null;
  infosFacturation: string | null;
  // Commentaire libre du dossier, partagé avec la fiche client.
  commentaire: string | null;
  // Suivi du colis expédié au client (La Poste/Chronopost).
  colisTransporteur: string | null;
  colisNumeroSuivi: string | null;
  colisSuiviStatut: string | null;
  colisSuiviLibelle: string | null;
}

// Tous les dossiers actifs avec leur état actionnable, pour le poste de travail ADV.
export async function fetchDossiersAdv(): Promise<DossierAdv[]> {
  const clients = await prisma.client.findMany({
    where: { archiveA: null },
    select: {
      id: true,
      raisonSociale: true,
      lot: { select: { nom: true } },
      departement: true,
      scenario: true,
      etapeMigrationId: true,
      nbTentativesContact: true,
      dernierContactLe: true,
      dateIntervention: true,
      creneauIntervention: true,
      technicienId: true,
      technicien: { select: { nom: true } },
      lienCommande: true,
      lienLivre: true,
      zohoLignePousseeLe: true,
      routeurClientReutilise: true,
      statutSuivi: true,
      dateImperative: true,
      materielRecu: true,
      numeroChrono: true,
      infosFacturation: true,
      commentaire: true,
      colisTransporteur: true,
      colisNumeroSuivi: true,
      colisSuiviStatut: true,
      colisSuiviLibelle: true,
      mailEnvois: {
        where: { succes: true },
        orderBy: { creeLe: "desc" },
        select: { type: true, creeLe: true },
      },
    },
    orderBy: { raisonSociale: "asc" },
  });

  const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
  return clients.map((c) => ({
    clientId: c.id,
    raisonSociale: c.raisonSociale,
    lotNom: c.lot?.nom ?? null,
    departement: c.departement,
    etapeMigrationId: c.etapeMigrationId,
    nbTentativesContact: c.nbTentativesContact,
    dernierContactLe: d(c.dernierContactLe),
    dateIso: d(c.dateIntervention),
    creneau: c.creneauIntervention,
    technicienId: c.technicienId,
    technicienNom: c.technicien?.nom ?? null,
    avecLien: (c.scenario ?? "").toLowerCase().includes("lien"),
    lienCommande: c.lienCommande,
    lienLivre: c.lienLivre,
    mailPrevenanceLe: d(c.mailEnvois.find((m) => m.type === "PREVENANCE")?.creeLe ?? null),
    mailConfirmationLe: d(c.mailEnvois.find((m) => m.type === "CONFIRMATION")?.creeLe ?? null),
    zohoPousseLe: d(c.zohoLignePousseeLe),
    routeurClientReutilise: c.routeurClientReutilise,
    statutSuivi: c.statutSuivi,
    dateImperativeIso: d(c.dateImperative),
    materielRecu: c.materielRecu,
    numeroChrono: c.numeroChrono,
    infosFacturation: c.infosFacturation,
    commentaire: c.commentaire,
    colisTransporteur: c.colisTransporteur,
    colisNumeroSuivi: c.colisNumeroSuivi,
    colisSuiviStatut: c.colisSuiviStatut,
    colisSuiviLibelle: c.colisSuiviLibelle,
  }));
}

export interface AdvOverview {
  affectes: { clientId: string; raisonSociale: string; technicienNom: string; dateIso: string | null; etape: string | null }[];
  parEtape: { libelle: string; couleur: string; count: number }[];
  liens: { nonCommande: number; commande: number; livre: number };
}

// Vue d'ensemble pour la page ADV: qui est affecté, avancement des étapes (portabilité),
// état des commandes de lien. Agrégats calculés sur les clients actifs.
export async function fetchAdvOverview(): Promise<AdvOverview> {
  const [affectes, etapes, clients] = await Promise.all([
    prisma.client.findMany({
      where: { archiveA: null, technicienId: { not: null } },
      select: {
        id: true,
        raisonSociale: true,
        dateIntervention: true,
        technicien: { select: { nom: true } },
        etapeMigration: { select: { libelle: true } },
      },
      orderBy: [{ dateIntervention: "asc" }, { raisonSociale: "asc" }],
    }),
    prisma.etapeMigration.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
      select: { libelle: true, couleur: true, _count: { select: { clients: true } } },
    }),
    prisma.client.findMany({
      where: { archiveA: null },
      select: { lienCommande: true, lienLivre: true, scenario: true },
    }),
  ]);

  const liens = { nonCommande: 0, commande: 0, livre: 0 };
  for (const c of clients) {
    if (!(c.scenario ?? "").toLowerCase().includes("lien")) continue;
    if (c.lienLivre) liens.livre++;
    else if (c.lienCommande) liens.commande++;
    else liens.nonCommande++;
  }

  return {
    affectes: affectes.map((a) => ({
      clientId: a.id,
      raisonSociale: a.raisonSociale,
      technicienNom: a.technicien?.nom ?? "—",
      dateIso: a.dateIntervention ? a.dateIntervention.toISOString().slice(0, 10) : null,
      etape: a.etapeMigration?.libelle ?? null,
    })),
    parEtape: etapes.map((e) => ({ libelle: e.libelle, couleur: e.couleur, count: e._count.clients })),
    liens,
  };
}

export async function listPrestataires(): Promise<{ id: string; nom: string }[]> {
  return prisma.prestataire.findMany({
    where: { actif: true },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}

export async function fetchTechniciens(): Promise<TechnicienLigne[]> {
  const techs = await prisma.technicien.findMany({
    include: { prestataire: { select: { nom: true } } },
    orderBy: [{ actif: "desc" }, { nom: "asc" }],
  });
  return techs.map((t) => ({
    id: t.id,
    nom: t.nom,
    prestataireId: t.prestataireId,
    prestataireNom: t.prestataire?.nom ?? null,
    departements: t.departements,
    actif: t.actif,
  }));
}

// Techniciens disponibles à une date (optionnellement filtrés par département), calculés depuis
// les affectations existantes. Le technicien déjà affecté au client courant est réintégré pour
// qu'il reste sélectionnable sur sa propre fiche.
export async function fetchTechniciensDisponibles(
  date: Date,
  departement?: string,
  technicienDejaAffecteId?: string | null
): Promise<TechnicienLite[]> {
  const [techs, affectations, affectationsZoho] = await Promise.all([
    prisma.technicien.findMany({
      where: { actif: true },
      select: { id: true, nom: true, departements: true },
    }),
    prisma.client.findMany({
      where: { archiveA: null, technicienId: { not: null } },
      select: { technicienId: true, dateIntervention: true },
    }),
    // Affectations déjà posées dans le Zoho Sheet (source opérationnelle réelle).
    lireAffectationsSheet(),
  ]);
  const affs: Affectation[] = affectations.map((a) => ({
    technicienId: a.technicienId as string,
    date: a.dateIntervention,
  }));
  const occupesZoho = nomsTechOccupes(affectationsZoho, date);
  const dispo = techniciensDisponibles(techs, affs, date, departement, occupesZoho);
  // Réintègre le technicien déjà affecté au client (sinon il disparaît de son propre select).
  if (technicienDejaAffecteId && !dispo.some((t) => t.id === technicienDejaAffecteId)) {
    const t = techs.find((x) => x.id === technicienDejaAffecteId);
    if (t) dispo.push(t);
  }
  return dispo.sort((a, b) => a.nom.localeCompare(b.nom));
}

// --- Mutations ---

export async function affecterTechnicien(
  clientId: string,
  technicienId: string | null
): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId, archiveA: null },
    data: { technicienId },
  });
}

export async function creerTechnicien(
  nom: string,
  prestataireId: string | null,
  departements: string[]
): Promise<void> {
  await prisma.technicien.create({ data: { nom, prestataireId, departements } });
}

export async function updateTechnicien(
  id: string,
  data: { nom?: string; prestataireId?: string | null; departements?: string[]; actif?: boolean }
): Promise<void> {
  await prisma.technicien.update({ where: { id }, data });
}

export async function supprimerTechnicien(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const nb = await prisma.client.count({ where: { technicienId: id } });
  if (nb > 0) {
    return { success: false, error: "Technicien affecté à des interventions : désactivez-le plutôt." };
  }
  await prisma.technicien.delete({ where: { id } });
  return { success: true };
}
