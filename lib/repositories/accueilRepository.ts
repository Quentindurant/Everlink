import { prisma } from "@/lib/prisma";
import { SEUIL_TENTATIVES } from "@/lib/domain/migration/etapes";

export interface InterventionProche {
  clientId: string;
  raisonSociale: string;
  dateIso: string;
  technicienNom: string | null;
  etape: string | null;
  etapeCouleur: string | null;
  lienStatut: string | null;
}

export interface AccueilData {
  interventions: InterventionProche[];
  bloques: { clientId: string; raisonSociale: string; etape: string | null }[];
  aRelancer: { clientId: string; raisonSociale: string; tentatives: number }[];
  liensACommander: number;
  stock: { enStock: number; aEnvoyer: number; aInstaller: number };
}

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// Agrège l'essentiel du jour pour la page d'accueil: interventions à venir, dossiers bloqués,
// clients à relancer, liens à commander, état du stock.
export async function fetchAccueil(): Promise<AccueilData> {
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);

  const [interventions, bloques, aRelancer, clientsLien, stock] = await Promise.all([
    prisma.client.findMany({
      where: { archiveA: null, dateIntervention: { gte: debutJour } },
      select: {
        id: true,
        raisonSociale: true,
        dateIntervention: true,
        lienCommande: true,
        lienLivre: true,
        scenario: true,
        technicien: { select: { nom: true } },
        etapeMigration: { select: { libelle: true, couleur: true } },
      },
      orderBy: { dateIntervention: "asc" },
      take: 20,
    }),
    prisma.client.findMany({
      where: { archiveA: null, etapeMigration: { estBloquant: true } },
      select: { id: true, raisonSociale: true, etapeMigration: { select: { libelle: true } } },
      orderBy: { raisonSociale: "asc" },
      take: 30,
    }),
    prisma.client.findMany({
      where: { archiveA: null, nbTentativesContact: { gte: SEUIL_TENTATIVES } },
      select: { id: true, raisonSociale: true, nbTentativesContact: true },
      orderBy: { nbTentativesContact: "desc" },
      take: 30,
    }),
    prisma.client.findMany({
      where: { archiveA: null, lienCommande: false },
      select: { scenario: true },
    }),
    prisma.articleStock.groupBy({
      by: ["statut"],
      where: { archiveA: null },
      _count: { _all: true },
    }),
  ]);

  const compteStock = new Map(stock.map((s) => [s.statut, s._count._all]));

  return {
    interventions: interventions.map((c) => ({
      clientId: c.id,
      raisonSociale: c.raisonSociale,
      dateIso: jour(c.dateIntervention) as string,
      technicienNom: c.technicien?.nom ?? null,
      etape: c.etapeMigration?.libelle ?? null,
      etapeCouleur: c.etapeMigration?.couleur ?? null,
      lienStatut: (c.scenario ?? "").toLowerCase().includes("lien")
        ? c.lienLivre
          ? "Livré"
          : c.lienCommande
            ? "Commandé"
            : "Non commandé"
        : null,
    })),
    bloques: bloques.map((c) => ({
      clientId: c.id,
      raisonSociale: c.raisonSociale,
      etape: c.etapeMigration?.libelle ?? null,
    })),
    aRelancer: aRelancer.map((c) => ({
      clientId: c.id,
      raisonSociale: c.raisonSociale,
      tentatives: c.nbTentativesContact,
    })),
    liensACommander: clientsLien.filter((c) => (c.scenario ?? "").toLowerCase().includes("lien")).length,
    stock: {
      enStock: compteStock.get("EN_STOCK") ?? 0,
      aEnvoyer: compteStock.get("CONFIGURE") ?? 0,
      aInstaller: compteStock.get("ENVOYE") ?? 0,
    },
  };
}
