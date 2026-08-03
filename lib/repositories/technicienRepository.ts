import { prisma } from "@/lib/prisma";
import {
  techniciensDisponibles,
  type Affectation,
  type TechnicienLite,
} from "@/lib/domain/technicien/disponibilite";

export interface TechnicienLigne {
  id: string;
  nom: string;
  prestataireId: string | null;
  prestataireNom: string | null;
  departements: string[];
  actif: boolean;
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
  const [techs, affectations] = await Promise.all([
    prisma.technicien.findMany({
      where: { actif: true },
      select: { id: true, nom: true, departements: true },
    }),
    prisma.client.findMany({
      where: { archiveA: null, technicienId: { not: null } },
      select: { technicienId: true, dateIntervention: true },
    }),
  ]);
  const affs: Affectation[] = affectations.map((a) => ({
    technicienId: a.technicienId as string,
    date: a.dateIntervention,
  }));
  const dispo = techniciensDisponibles(techs, affs, date, departement);
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
