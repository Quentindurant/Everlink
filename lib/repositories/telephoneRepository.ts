import { prisma } from "@/lib/prisma";
import { estEtapeResolue, STATUTS_ETAPE_RESOLUS } from "@/lib/domain/telephone/statuts";
import { estPrestataireTraite } from "@/lib/domain/prestataires/statuts";

export interface TelephoneUtilisateurLigne {
  utilisateurId: string;
  utilisateurNom: string;
  clientId: string;
  clientRaisonSociale: string;
  // Tech qui s'est attribué le client (email), null si personne.
  clientAttribueA: string | null;
  // Lot de migration : le chantier avance lot par lot.
  clientLotNom: string | null;
  // Intervention planifiée par l'ADV : le tech configure dans cet ordre.
  clientDateIso: string | null;
  clientCreneau: string | null;
  // Site d'affectation du poste, pour les clients multi-établissements (null = non précisé).
  siteId: string | null;
  // Softphone à réinstaller (DOKO chez Sewan → Speek chez UNYC) : à préparer avec le client.
  softphone: boolean;
  // Dossier mis en pause : visible mais signalé, sorti des dossiers à travailler.
  clientBloque: boolean;
  clientBloqueMotif: string | null;
  // Prestataires externes restant à joindre avant l'intervention.
  prestatairesATraiter: number;
  prestatairesTotal: number;
  // etapeId -> statut ("À faire" implicite si absent)
  statuts: Record<string, string>;
  // Infos du poste, copiables par les techniciens pendant la configuration.
  numeros: { brut: string; courts: string[] }[];
  equipements: { mac: string; modele: string | null }[];
}

export interface TelephoneGrille {
  etapes: { id: string; libelle: string }[];
  utilisateurs: TelephoneUtilisateurLigne[];
  valeursStatut: string[];
  // Sites par client : vide pour un client mono-établissement (rien à choisir).
  sitesParClient: Record<string, { id: string; nom: string }[]>;
}

// Avancement d'un client, du point de vue du technicien : rien de coché, travail entamé,
// ou toutes les étapes résolues sur tous ses postes.
export type FiltreAvancement = "non_commence" | "en_cours" | "termine";

export async function fetchTelephoneGrille(filtres: {
  clientId?: string;
  recherche?: string;
  avancement?: FiltreAvancement;
} = {}): Promise<TelephoneGrille> {
  const [etapes, valeurs, utilisateurs] = await Promise.all([
    prisma.etapeModele.findMany({ where: { actif: true }, orderBy: { ordre: "asc" } }),
    prisma.listeValeur.findMany({
      where: { categorie: "STATUT_ETAPE", actif: true },
      orderBy: { ordre: "asc" },
    }),
    prisma.utilisateur.findMany({
      where: {
        archiveA: null,
        client: { archiveA: null },
        ...(filtres.clientId ? { clientId: filtres.clientId } : {}),
        ...(filtres.recherche
          ? {
              OR: [
                { nom: { contains: filtres.recherche, mode: "insensitive" } },
                {
                  client: {
                    raisonSociale: { contains: filtres.recherche, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            raisonSociale: true,
            dateIntervention: true,
            telephoneAttribueA: true,
            creneauIntervention: true,
            telephoneBloque: true,
            telephoneBloqueMotif: true,
            lot: { select: { nom: true } },
            prestataires: { select: { statutContact: true } },
            sites: {
              select: { id: true, nom: true },
              orderBy: [{ ordre: "asc" }, { creeLe: "asc" }],
            },
          },
        },
        suivis: { where: { etape: { actif: true } } },
        numeros: {
          where: { archiveA: null },
          orderBy: { ordre: "asc" },
          select: { numeroBrut: true, numerosCourts: true },
        },
        equipements: {
          where: { archiveA: null },
          orderBy: { ordre: "asc" },
          select: { macBrut: true, modele: { select: { libelle: true, type: true } } },
        },
      },
      // Même ordre que le Provisionning: interventions planifiées les plus proches d'abord.
      orderBy: [
        { client: { lot: { nom: "asc" } } },
        { client: { dateIntervention: { sort: "asc", nulls: "last" } } },
        { client: { raisonSociale: "asc" } },
        { ordre: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  // Filtre d'avancement : il porte sur le client entier, pas sur le poste. Un technicien
  // cherche « ce qui n'est pas commencé » ou « ce qui reste à finir » à l'échelle du dossier.
  let retenus = utilisateurs;
  if (filtres.avancement) {
    const parClient = new Map<string, { faits: number; total: number }>();
    for (const u of utilisateurs) {
      const e = parClient.get(u.clientId) ?? { faits: 0, total: 0 };
      e.faits += etapes.filter((et) => estEtapeResolue(u.suivis.find((s) => s.etapeId === et.id)?.statut)).length;
      e.total += etapes.length;
      parClient.set(u.clientId, e);
    }
    const garde = (clientId: string) => {
      const e = parClient.get(clientId);
      if (!e || e.total === 0) return false;
      if (filtres.avancement === "non_commence") return e.faits === 0;
      if (filtres.avancement === "termine") return e.faits === e.total;
      return e.faits > 0 && e.faits < e.total;
    };
    retenus = utilisateurs.filter((u) => garde(u.clientId));
  }

  // Un client n'apparaît ici que s'il a plusieurs adresses : sinon rien à affecter.
  const sitesParClient: Record<string, { id: string; nom: string }[]> = {};
  for (const u of retenus) {
    if (u.client.sites.length > 1) sitesParClient[u.client.id] = u.client.sites;
  }

  return {
    etapes: etapes.map((e) => ({ id: e.id, libelle: e.libelle })),
    valeursStatut: valeurs.map((v) => v.valeur),
    sitesParClient,
    utilisateurs: retenus.map((u) => ({
      utilisateurId: u.id,
      utilisateurNom: u.nom,
      clientId: u.client.id,
      clientRaisonSociale: u.client.raisonSociale,
      clientAttribueA: u.client.telephoneAttribueA,
      clientLotNom: u.client.lot?.nom ?? null,
      clientDateIso: u.client.dateIntervention?.toISOString().slice(0, 10) ?? null,
      clientCreneau: u.client.creneauIntervention,
      siteId: u.siteId,
      softphone: u.equipements.some((e) => e.modele?.type === "SOFTPHONE"),
      clientBloque: u.client.telephoneBloque,
      clientBloqueMotif: u.client.telephoneBloqueMotif,
      prestatairesATraiter: u.client.prestataires.filter(
        (p) => !estPrestataireTraite(p.statutContact)
      ).length,
      prestatairesTotal: u.client.prestataires.length,
      statuts: Object.fromEntries(u.suivis.map((s) => [s.etapeId, s.statut])),
      numeros: u.numeros.map((n) => ({ brut: n.numeroBrut, courts: n.numerosCourts })),
      equipements: u.equipements
        .filter((e) => e.macBrut)
        .map((e) => ({ mac: e.macBrut, modele: e.modele?.libelle ?? null })),
    })),
  };
}

export async function setSuiviEtape(
  utilisateurId: string,
  etapeId: string,
  statut: string,
  auteur: string | null
): Promise<void> {
  const fait = statut === "Fait";
  await prisma.suiviEtape.upsert({
    where: { utilisateurId_etapeId: { utilisateurId, etapeId } },
    update: { statut, faitLe: fait ? new Date() : null, faitPar: fait ? auteur : null },
    create: {
      utilisateurId,
      etapeId,
      statut,
      faitLe: fait ? new Date() : null,
      faitPar: fait ? auteur : null,
    },
  });
}

export async function setEtapeClient(
  clientId: string,
  etapeId: string,
  statut: string,
  auteur: string | null
): Promise<number> {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { clientId, archiveA: null },
    select: { id: true },
  });
  const fait = statut === "Fait";
  await prisma.$transaction(
    utilisateurs.map((u) =>
      prisma.suiviEtape.upsert({
        where: { utilisateurId_etapeId: { utilisateurId: u.id, etapeId } },
        update: { statut, faitLe: fait ? new Date() : null, faitPar: fait ? auteur : null },
        create: {
          utilisateurId: u.id,
          etapeId,
          statut,
          faitLe: fait ? new Date() : null,
          faitPar: fait ? auteur : null,
        },
      })
    )
  );
  return utilisateurs.length;
}

// Affecte un poste à un site du client (chaîne vide = site non précisé).
export async function affecterSiteUtilisateur(
  utilisateurId: string,
  siteId: string
): Promise<void> {
  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { siteId: siteId || null },
  });
}

// Affecte d'un coup tous les postes du client encore sans site : à l'import Sewan aucun
// poste n'a de site, on les répartit ensuite site par site.
export async function affecterSiteRestants(clientId: string, siteId: string): Promise<number> {
  const r = await prisma.utilisateur.updateMany({
    where: { clientId, archiveA: null, siteId: null },
    data: { siteId },
  });
  return r.count;
}

export interface ProgressionChantier {
  // Un numéro = un poste : le chantier se compte en postes migrés, pas en cases cochées.
  postesFaits: number;
  postesTotal: number;
  pct: number;
  clientsFaits: number;
  clientsTotal: number;
}

// L'avancement est relu à chaque affichage de page (barre latérale) alors qu'il bouge
// lentement : on le garde en mémoire deux minutes. Sans ce cache, une navigation de vingt
// pages coûtait quatre-vingts requêtes pour une valeur qui n'avait pas changé — la base est
// facturée à l'opération, et la barre latérale était le premier poste de dépense.
const CACHE_PROGRESSION_MS = 120_000;
let cacheProgression: { at: number; data: ProgressionChantier } | null = null;

// Avancement global affiché dans la sidebar. Un poste est « fait » quand toutes les étapes
// actives sont résolues (Fait ou Aucun) ; un client est fait quand tous ses postes le sont.
export async function fetchProgressionChantier(): Promise<ProgressionChantier> {
  if (cacheProgression && Date.now() - cacheProgression.at < CACHE_PROGRESSION_MS) {
    return cacheProgression.data;
  }
  const data = await calculerProgressionChantier();
  cacheProgression = { at: Date.now(), data };
  return data;
}

async function calculerProgressionChantier(): Promise<ProgressionChantier> {
  const [etapesActives, utilisateurs, clientsTotal] = await Promise.all([
    prisma.etapeModele.count({ where: { actif: true } }),
    prisma.utilisateur.findMany({
      where: { archiveA: null, client: { archiveA: null } },
      select: {
        clientId: true,
        suivis: {
          where: { etape: { actif: true }, statut: { in: STATUTS_ETAPE_RESOLUS } },
          select: { id: true },
        },
      },
    }),
    prisma.client.count({ where: { archiveA: null } }),
  ]);

  const posteFait = (u: { suivis: unknown[] }) =>
    etapesActives > 0 && u.suivis.length >= etapesActives;
  const postesFaits = utilisateurs.filter(posteFait).length;

  // Un client compte comme terminé s'il a des postes et qu'ils sont tous faits.
  const parClient = new Map<string, { total: number; faits: number }>();
  for (const u of utilisateurs) {
    const e = parClient.get(u.clientId) ?? { total: 0, faits: 0 };
    e.total++;
    if (posteFait(u)) e.faits++;
    parClient.set(u.clientId, e);
  }
  const clientsFaits = [...parClient.values()].filter((c) => c.total > 0 && c.faits === c.total).length;

  return {
    postesFaits,
    postesTotal: utilisateurs.length,
    pct: utilisateurs.length > 0 ? Math.round((postesFaits / utilisateurs.length) * 100) : 0,
    clientsFaits,
    clientsTotal,
  };
}
