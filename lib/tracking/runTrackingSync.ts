// Rafraîchit l'état de tous les colis en cours (staging + dossiers ADV) via l'API La Poste.
// Appelé par le cron POST /api/cron/tracking-sync. Ne touche pas les colis déjà livrés ni sans
// numéro. Chaque interrogation est indépendante : une erreur réseau sur un colis n'arrête pas
// les autres, et l'état précédent est conservé si La Poste ne répond pas.
import { prisma } from "@/lib/prisma";
import { laPosteConfigure, suivreColis } from "@/lib/tracking/laPosteClient";
import { transporteurAvecSuiviApi } from "@/lib/domain/tracking/laposte";

export interface TrackingSyncResult {
  succes: boolean;
  configure: boolean;
  articlesVerifies: number;
  clientsVerifies: number;
  lotsVerifies: number;
  misAJour: number;
  message?: string;
}

export async function runTrackingSync(): Promise<TrackingSyncResult> {
  if (!laPosteConfigure()) {
    return {
      succes: false,
      configure: false,
      articlesVerifies: 0,
      clientsVerifies: 0,
      lotsVerifies: 0,
      misAJour: 0,
      message: "API_KEY_LAPOSTE absente : suivi désactivé.",
    };
  }

  // Colis non livrés uniquement (statut null = jamais relevé, ou EN_COURS/INCONNU).
  const [articles, clients, lots] = await Promise.all([
    prisma.articleStock.findMany({
      where: {
        archiveA: null,
        numeroSuivi: { not: null },
        NOT: { suiviStatut: "LIVRE" },
      },
      select: { id: true, numeroSuivi: true, transporteur: true },
    }),
    prisma.client.findMany({
      where: {
        archiveA: null,
        colisNumeroSuivi: { not: null },
        NOT: { colisSuiviStatut: "LIVRE" },
      },
      select: { id: true, colisNumeroSuivi: true, colisTransporteur: true },
    }),
    prisma.lotRetourOnt.findMany({
      where: {
        numeroSuivi: { not: null },
        NOT: { suiviStatut: "LIVRE" },
      },
      select: { id: true, numeroSuivi: true, transporteur: true },
    }),
  ]);

  let misAJour = 0;

  for (const a of articles) {
    // DHL et autres transporteurs hors API La Poste : pas de relevé automatique.
    if (!transporteurAvecSuiviApi(a.transporteur)) continue;
    const etat = await suivreColis(a.numeroSuivi as string);
    if (!etat) continue;
    await prisma.articleStock.update({
      where: { id: a.id },
      data: {
        suiviStatut: etat.statut,
        suiviLibelle: etat.libelle,
        suiviEtape: etat.etape,
        suiviLivreLe: etat.livreLe ? new Date(etat.livreLe) : null,
        suiviMajLe: new Date(),
      },
    });
    misAJour++;
  }

  for (const c of clients) {
    if (!transporteurAvecSuiviApi(c.colisTransporteur)) continue;
    const etat = await suivreColis(c.colisNumeroSuivi as string);
    if (!etat) continue;
    await prisma.client.update({
      where: { id: c.id },
      data: {
        colisSuiviStatut: etat.statut,
        colisSuiviLibelle: etat.libelle,
        colisSuiviEtape: etat.etape,
        colisSuiviLivreLe: etat.livreLe ? new Date(etat.livreLe) : null,
        colisSuiviMajLe: new Date(),
      },
    });
    misAJour++;
  }

  for (const l of lots) {
    // DHL et autres transporteurs hors API La Poste : pas de relevé automatique.
    if (!transporteurAvecSuiviApi(l.transporteur)) continue;
    const etat = await suivreColis(l.numeroSuivi as string);
    if (!etat) continue;
    await prisma.lotRetourOnt.update({
      where: { id: l.id },
      data: {
        suiviStatut: etat.statut,
        suiviLibelle: etat.libelle,
        suiviEtape: etat.etape,
        suiviLivreLe: etat.livreLe ? new Date(etat.livreLe) : null,
        suiviMajLe: new Date(),
      },
    });
    misAJour++;
  }

  return {
    succes: true,
    configure: true,
    articlesVerifies: articles.length,
    clientsVerifies: clients.length,
    lotsVerifies: lots.length,
    misAJour,
  };
}
