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
  });

  const equipementsForNumeros = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      client: { archiveA: null },
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
    },
    include: { modele: true },
  });
  const equipementByUtilisateurId = new Map(
    equipementsForNumeros.map((e) => [e.utilisateurId as string, e])
  );

  const numeroRows: ProvisionningNumeroRow[] = numeros.map((n) => {
    const equipement = n.utilisateurId ? equipementByUtilisateurId.get(n.utilisateurId) : undefined;
    return {
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numerosCourts: n.numerosCourts,
      controleNiveau: n.controleNiveau,
      equipementModeleLibelle: equipement?.modele?.libelle ?? equipement?.modeleLibelleBrut ?? null,
      equipementMacBrut: equipement?.macBrut ?? null,
      utilisateurNom: n.utilisateur?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
    };
  });

  const orphanEquipements = await prisma.equipement.findMany({
    where: { archiveA: null, client: { archiveA: null }, utilisateurId: null },
    include: { client: true, modele: true },
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
  });

  return clients.map((c) => ({
    raisonSociale: c.raisonSociale,
    lotNom: c.lot?.nom ?? null,
    nbNumeros: c.numeros.length,
    nbMacSaisis: c.equipements.length,
    nbMacDistincts: new Set(c.equipements.map((e) => e.macNormalise)).size,
    nbBasculesFaites: c.numeros.filter((n) => n.statutBascule === "Fait").length,
    statutGlobal: c.statutBascule,
    scenario: c.scenario,
    adresse: c.adresse,
    contactNom: c.contactNom,
    contactPrenom: c.contactPrenom,
    nbPostesAnnonce: c.nbPostesAnnonce,
    nbEquipements: c.equipements.length,
  }));
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
    include: { client: true, suivis: { include: { etape: true } } },
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
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
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
    orderBy: [{ client: { creeLe: "asc" } }, { ordre: "asc" }],
  });

  return equipements.map((e) => ({
    clientRaisonSociale: e.client.raisonSociale,
    macBrut: e.macBrut,
    macNormalise: e.macNormalise,
  }));
}
