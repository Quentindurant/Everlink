import { prisma } from "@/lib/prisma";
import { estPrestataireTraite } from "@/lib/domain/prestataires/statuts";

export interface PrestataireLigne {
  id: string;
  metier: string;
  societe: string;
  contactNom: string | null;
  telephone: string | null;
  email: string | null;
  commentaire: string | null;
  statutContact: string;
  contacteLeIso: string | null;
  contactePar: string | null;
  noteContact: string | null;
  creePar: string | null;
}

export async function fetchPrestataires(clientId: string): Promise<PrestataireLigne[]> {
  const lignes = await prisma.prestataireClient.findMany({
    where: { clientId },
    orderBy: [{ creeLe: "asc" }],
  });
  return lignes.map((p) => ({
    id: p.id,
    metier: p.metier,
    societe: p.societe,
    contactNom: p.contactNom,
    telephone: p.telephone,
    email: p.email,
    commentaire: p.commentaire,
    statutContact: p.statutContact,
    contacteLeIso: p.contacteLe?.toISOString().slice(0, 10) ?? null,
    contactePar: p.contactePar,
    noteContact: p.noteContact,
    creePar: p.creePar,
  }));
}

// Compteurs par client pour les listes : combien de prestataires, combien restent à traiter.
// Une seule requête, agrégée en mémoire — le volume est petit (quelques dizaines de lignes).
export async function compterPrestatairesParClient(): Promise<
  Record<string, { total: number; aTraiter: number }>
> {
  const lignes = await prisma.prestataireClient.findMany({
    select: { clientId: true, statutContact: true },
  });
  const parClient: Record<string, { total: number; aTraiter: number }> = {};
  for (const l of lignes) {
    const e = parClient[l.clientId] ?? { total: 0, aTraiter: 0 };
    e.total++;
    if (!estPrestataireTraite(l.statutContact)) e.aTraiter++;
    parClient[l.clientId] = e;
  }
  return parClient;
}
