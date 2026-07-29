import { prisma } from "@/lib/prisma";
import type {
  ProvisionningNumeroRow,
  ProvisionningEquipementRow,
} from "@/lib/domain/sync/provisionning";
import type { ClientSyncRow } from "@/lib/domain/sync/clients";
import type { TelephoneUtilisateurRow } from "@/lib/domain/sync/telephone";
import type { SdaSourceRow } from "@/lib/domain/exports/sda";
import type { MacSourceRow } from "@/lib/domain/exports/mac";

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
      statutGlobal: c.statutBascule,
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

export async function fetchSdaData(): Promise<SdaSourceRow[]> {
  const numeros = await prisma.numero.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: { archiveA: null },
      utilisateurId: { not: null },
    },
    include: { client: true },
  });

  const eligibleEquipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: { archiveA: null },
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
      // Numero.clientId and Utilisateur.clientId aren't schema-enforced to match, and an
      // archived Utilisateur shouldn't make its numéro export-eligible.
      utilisateur: { archiveA: null },
      modele: { eligibleExport: true },
    },
    select: { utilisateurId: true },
  });
  const eligibleUtilisateurIds = new Set(eligibleEquipements.map((e) => e.utilisateurId));

  return numeros
    .filter((n) => n.utilisateurId && eligibleUtilisateurIds.has(n.utilisateurId))
    .map((n) => ({
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      ordre: n.ordre,
    }));
}

export async function fetchMacData(): Promise<MacSourceRow[]> {
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: { archiveA: null },
      modele: { eligibleExport: true },
    },
    include: { client: true },
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
  }));
}
