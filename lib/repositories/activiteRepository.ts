import { prisma } from "@/lib/prisma";

export interface ActiviteUtilisateur {
  id: string;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  enLigne: boolean;
  dernierVuLe: string | null; // ISO
  actions7j: number;
  actionsTotal: number;
}

export interface EntreeJournal {
  auteurNom: string;
  entite: string;
  action: string;
  apres: string | null;
  creeLe: string; // ISO
}

export interface ActiviteEquipe {
  utilisateurs: ActiviteUtilisateur[];
  recentes: EntreeJournal[];
}

const EN_LIGNE_MS = 5 * 60 * 1000;

// Vue d'ensemble de l'activité pour l'admin : présence, classement d'actions, journal récent.
export async function fetchActiviteEquipe(): Promise<ActiviteEquipe> {
  const depuis7j = new Date(Date.now() - 7 * 86400000);
  const [comptes, par7j, parTotal, recentes] = await Promise.all([
    prisma.utilisateurApp.findMany({
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      select: { id: true, nom: true, email: true, role: true, actif: true, derniereActiviteLe: true },
    }),
    prisma.auditLog.groupBy({
      by: ["auteurId"],
      where: { creeLe: { gte: depuis7j }, auteurId: { not: null } },
      _count: { _all: true },
    }),
    prisma.auditLog.groupBy({
      by: ["auteurId"],
      where: { auteurId: { not: null } },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { creeLe: "desc" },
      take: 30,
      include: { auteur: { select: { nom: true, email: true } } },
    }),
  ]);

  const m7 = new Map(par7j.map((g) => [g.auteurId, g._count._all]));
  const mt = new Map(parTotal.map((g) => [g.auteurId, g._count._all]));
  const maintenant = Date.now();

  return {
    utilisateurs: comptes
      .map((c) => ({
        id: c.id,
        nom: c.nom,
        email: c.email,
        role: c.role,
        actif: c.actif,
        enLigne:
          !!c.derniereActiviteLe && maintenant - c.derniereActiviteLe.getTime() < EN_LIGNE_MS,
        dernierVuLe: c.derniereActiviteLe?.toISOString() ?? null,
        actions7j: m7.get(c.id) ?? 0,
        actionsTotal: mt.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.actions7j - a.actions7j || b.actionsTotal - a.actionsTotal),
    recentes: recentes.map((r) => ({
      auteurNom: r.auteur?.nom ?? r.auteur?.email ?? "—",
      entite: r.entite,
      action: r.action,
      apres: r.apres,
      creeLe: r.creeLe.toISOString(),
    })),
  };
}
