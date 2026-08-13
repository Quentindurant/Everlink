import { prisma } from "@/lib/prisma";
import type {
  ProvisionningNumeroRow,
  ProvisionningEquipementRow,
} from "@/lib/domain/sync/provisionning";
import type { ClientSyncRow } from "@/lib/domain/sync/clients";
import type { TelephoneUtilisateurRow } from "@/lib/domain/sync/telephone";
import { motifExclusionNumero, type SdaSourceRow } from "@/lib/domain/exports/sda";
import type { MacSourceRow } from "@/lib/domain/exports/mac";
import { ETAPE_TERMINALE } from "@/lib/domain/migration/etapes";

// Portée d'export (SPEC §6.4): lot entier, client(s) précis, et option d'exclusion des
// clients déjà basculés (décochée par défaut — ETIKEO sort alors que sa bascule est "Fait").
export interface ExportScope {
  lotId?: string;
  clientIds?: string[];
  exclureBascules?: boolean;
}

export interface ExportEcart {
  raisonSociale: string;
  valeur: string;
  motif: string;
}

// "Exclure les clients déjà basculés" filtre désormais sur l'étape de migration (source de
// vérité) et non plus sur Client.statutBascule: un client est basculé quand son étape a un
// ordre >= à celui de l'étape terminale. Async car il faut lire l'ordre de l'étape terminale.
async function clientScopeWhere(scope: ExportScope) {
  const base = {
    archiveA: null,
    ...(scope.lotId ? { lotId: scope.lotId } : {}),
    ...(scope.clientIds && scope.clientIds.length > 0
      ? { id: { in: scope.clientIds } }
      : {}),
  };
  if (!scope.exclureBascules) return base;
  const terminale = await prisma.etapeMigration.findFirst({
    where: { libelle: ETAPE_TERMINALE },
    select: { ordre: true },
  });
  if (!terminale) return base;
  return { ...base, NOT: { etapeMigration: { ordre: { gte: terminale.ordre } } } };
}

export async function fetchProvisionningData(): Promise<{
  numeros: ProvisionningNumeroRow[];
  equipementsOrphelins: ProvisionningEquipementRow[];
}> {
  const numeros = await prisma.numero.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    include: {
      client: true,
      utilisateur: true,
    },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  // Prisma can't `where`-filter a to-one include, so an archived Utilisateur's equipment
  // must be excluded here at the query level (not just guarded in the mapping below).
  const equipementsForNumeros = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      client: { archiveA: null },
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
      utilisateur: { archiveA: null },
    },
    include: { modele: true },
    // Deterministic winner when a Utilisateur has multiple Equipement: highest `ordre` wins,
    // consistently across runs, since the accepted simplification is "show only one".
    // `ordre` defaults to 0 for every row, so it ties routinely — `id` is the final tiebreak.
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });
  const equipementByUtilisateurId = new Map(
    equipementsForNumeros.map((e) => [e.utilisateurId as string, e])
  );

  const numeroRows: ProvisionningNumeroRow[] = numeros.map((n) => {
    const equipement = n.utilisateurId ? equipementByUtilisateurId.get(n.utilisateurId) : undefined;
    // Guard against an archived Utilisateur's name leaking through: the `utilisateur` include
    // above is a to-one relation and can't be `where`-filtered by Prisma, so we must check
    // archiveA here instead of dropping numéros that legitimately have no user at all.
    const utilisateurActif = n.utilisateur && n.utilisateur.archiveA === null ? n.utilisateur : null;
    return {
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numerosCourts: n.numerosCourts,
      controleNiveau: n.controleNiveau,
      equipementModeleLibelle: equipement?.modele?.libelle ?? equipement?.modeleLibelleBrut ?? null,
      equipementMacBrut: equipement?.macBrut ?? null,
      utilisateurNom: utilisateurActif?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
    };
  });

  // Orphan equipment: no Utilisateur at all, OR an active Utilisateur with zero active Numero
  // (equipment attached to a user who has no numéro to attach to is otherwise unreachable —
  // it's neither in the numéro loop above nor caught by `utilisateurId: null`).
  const orphanEquipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      client: { archiveA: null },
      OR: [
        { utilisateurId: null },
        {
          utilisateur: {
            archiveA: null,
            numeros: { none: { archiveA: null } },
          },
        },
      ],
    },
    include: { client: true, modele: true },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  const equipementRows: ProvisionningEquipementRow[] = orphanEquipements.map((e) => ({
    clientRaisonSociale: e.client.raisonSociale,
    equipementModeleLibelle: e.modele?.libelle ?? e.modeleLibelleBrut ?? null,
    equipementMacBrut: e.macBrut,
    commentaire: e.commentaire,
  }));

  return { numeros: numeroRows, equipementsOrphelins: equipementRows };
}

export async function fetchClientsData(): Promise<ClientSyncRow[]> {
  const clients = await prisma.client.findMany({
    where: { archiveA: null },
    include: {
      lot: true,
      etapeMigration: { select: { libelle: true } },
      numeros: { where: { archiveA: null } },
      equipements: { where: { archiveA: null } },
    },
    orderBy: { raisonSociale: "asc" },
  });

  return clients.map((c) => {
    const nbEquipements = c.equipements.length;
    return {
      raisonSociale: c.raisonSociale,
      lotNom: c.lot?.nom ?? null,
      nbNumeros: c.numeros.length,
      nbMacSaisis: nbEquipements,
      nbMacDistincts: new Set(c.equipements.map((e) => e.macNormalise)).size,
      nbBasculesFaites: c.numeros.filter((n) => n.statutBascule === "Fait").length,
      // statutGlobal reflète désormais l'étape du parcours de migration (source de vérité).
      statutGlobal: c.etapeMigration?.libelle ?? "À qualifier",
      scenario: c.scenario,
      adresse: c.adresse,
      contactNom: c.contactNom,
      contactPrenom: c.contactPrenom,
      nbPostesAnnonce: c.nbPostesAnnonce,
      nbEquipements,
    };
  });
}

export async function fetchTelephoneData(): Promise<{
  utilisateurs: TelephoneUtilisateurRow[];
  etapeLibelles: string[];
}> {
  const etapes = await prisma.etapeModele.findMany({
    where: { actif: true },
    orderBy: { ordre: "asc" },
  });
  const etapeLibelles = etapes.map((e) => e.libelle);

  const utilisateurs = await prisma.utilisateur.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    include: {
      client: true,
      // Explicit filter to active étapes, matching the etapeLibelles set above, rather than
      // relying on the mapper below to silently ignore inactive-étape keys.
      suivis: { where: { etape: { actif: true } }, include: { etape: true } },
    },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  const rows: TelephoneUtilisateurRow[] = utilisateurs.map((u) => {
    const statutsParEtape: Record<string, string> = {};
    for (const suivi of u.suivis) {
      statutsParEtape[suivi.etape.libelle] = suivi.statut;
    }
    return {
      clientRaisonSociale: u.client.raisonSociale,
      utilisateurNom: u.nom,
      statutsParEtape,
    };
  });

  return { utilisateurs: rows, etapeLibelles };
}

// L'export SDA est la liste des numéros à porter: tout numéro actif et non exclu en fait partie,
// qu'il porte un équipement/MAC ou non. Un numéro SVI ou groupe d'appels (sans utilisateur ni
// MAC) doit être porté au même titre qu'un poste. Le lien à la MAC ne concerne que l'export MAC.
// Les mobiles (06/07) et les numéros de SIM sont écartés automatiquement (motifExclusionNumero).
export async function fetchSdaData(scope: ExportScope = {}): Promise<SdaSourceRow[]> {
  const clientWhere = await clientScopeWhere(scope);
  const numeros = await prisma.numero.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: clientWhere,
    },
    include: { client: true },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  return numeros
    .filter((n) => motifExclusionNumero(n.numeroBrut) === null)
    .map((n) => ({
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      ordre: n.ordre,
    }));
}

export async function fetchMacData(scope: ExportScope = {}): Promise<MacSourceRow[]> {
  const clientWhere = await clientScopeWhere(scope);
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: clientWhere,
      // Tout équipement porteur d'une MAC part à l'export (la répartition téléphonie/réseau se
      // fait ensuite sur le modèle). On écarte seulement les MAC vides (softphone DOKO, poste
      // sans MAC connue).
      macBrut: { not: "" },
      // Un utilisateur archivé ne doit pas faire sortir sa MAC. Le cas orphelin (équipement
      // sans utilisateur: borne DECT, réseau) reste un export légitime.
      OR: [{ utilisateurId: null }, { utilisateur: { archiveA: null } }],
    },
    include: { client: true, modele: { select: { libelle: true, marque: true } } },
    // buildMacRows (Task 6) deliberately preserves input order rather than sorting, so this
    // repository is the sole decider of MAC order. client.creeLe ties across a bulk import
    // (same transaction timestamp) and Equipement.ordre defaults to 0 for every row, so both
    // need a stable final tiebreak to avoid reshuffling between syncs on unchanged data.
    orderBy: [
      { client: { creeLe: "asc" } },
      { ordre: "asc" },
      { client: { id: "asc" } },
      { id: "asc" },
    ],
  });

  return equipements.map((e) => ({
    clientRaisonSociale: e.client.raisonSociale,
    macBrut: e.macBrut,
    macNormalise: e.macNormalise,
    modeleLibelle: e.modele?.libelle ?? null,
    marque: e.modele?.marque ?? null,
  }));
}

// Lignes écartées de l'export SDA avec motif: exclusion manuelle, numéro mobile ou numéro de
// SIM (les deux derniers sont détectés automatiquement, voir motifExclusionNumero).
export async function fetchSdaEcarts(scope: ExportScope = {}): Promise<ExportEcart[]> {
  const clientWhere = await clientScopeWhere(scope);
  const numeros = await prisma.numero.findMany({
    where: { archiveA: null, client: clientWhere },
    include: { client: { select: { raisonSociale: true } } },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  return numeros
    .map((n) => ({
      raisonSociale: n.client.raisonSociale,
      valeur: n.numeroBrut,
      motif: n.exclureExport ? "exclusion manuelle" : motifExclusionNumero(n.numeroBrut),
    }))
    .filter((e): e is ExportEcart => e.motif !== null);
}

// Lignes écartées de l'export MAC avec motif (SPEC §3.4).
export async function fetchMacEcarts(scope: ExportScope = {}): Promise<ExportEcart[]> {
  const clientWhere = await clientScopeWhere(scope);
  const equipements = await prisma.equipement.findMany({
    where: { archiveA: null, client: clientWhere },
    include: {
      client: { select: { raisonSociale: true } },
      utilisateur: { select: { archiveA: true } },
      modele: { select: { eligibleExport: true } },
    },
    orderBy: [
      { client: { creeLe: "asc" } },
      { ordre: "asc" },
      { client: { id: "asc" } },
      { id: "asc" },
    ],
  });

  const ecarts: ExportEcart[] = [];
  const vues = new Set<string>();
  for (const e of equipements) {
    const base = { raisonSociale: e.client.raisonSociale, valeur: e.macBrut };
    const cle = `${e.client.raisonSociale} ${e.macNormalise}`;
    if (!e.macBrut) {
      ecarts.push({ ...base, motif: "pas de MAC (softphone / poste sans MAC)" });
    } else if (e.exclureExport) {
      ecarts.push({ ...base, motif: "exclusion manuelle" });
    } else if (e.utilisateur?.archiveA) {
      ecarts.push({ ...base, motif: "utilisateur archivé" });
    } else if (vues.has(cle)) {
      ecarts.push({ ...base, motif: "doublon (MAC déjà exportée pour ce client)" });
    } else {
      vues.add(cle);
    }
  }
  return ecarts;
}

// Équipements listés à part sur l'export MAC : pieuvres de conférence et postes déclarés
// différemment côté UNYC (T42U…). Le drapeau vit sur le modèle, cochable dans Paramètres.
export interface EquipementSepareLigne {
  clientId: string;
  clientRaisonSociale: string;
  modeleLibelle: string;
  macBrut: string;
  utilisateurNom: string | null;
  numeros: string[];
}

export async function fetchEquipementsSepares(
  scope: ExportScope = {}
): Promise<EquipementSepareLigne[]> {
  const clientWhere = await clientScopeWhere(scope);
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      client: clientWhere,
      modele: { exportSepare: true },
      OR: [{ utilisateurId: null }, { utilisateur: { archiveA: null } }],
    },
    include: {
      client: { select: { id: true, raisonSociale: true } },
      modele: { select: { libelle: true } },
      utilisateur: {
        select: {
          nom: true,
          numeros: { where: { archiveA: null }, select: { numeroBrut: true } },
        },
      },
    },
    orderBy: [{ modele: { libelle: "asc" } }, { client: { raisonSociale: "asc" } }, { id: "asc" }],
  });
  return equipements.map((e) => ({
    clientId: e.client.id,
    clientRaisonSociale: e.client.raisonSociale,
    modeleLibelle: e.modele?.libelle ?? "—",
    macBrut: e.macBrut,
    utilisateurNom: e.utilisateur?.nom ?? null,
    numeros: e.utilisateur?.numeros.map((n) => n.numeroBrut) ?? [],
  }));
}
