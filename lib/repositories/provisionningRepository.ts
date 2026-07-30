import { prisma } from "@/lib/prisma";
import { evaluerControle, type NiveauControle } from "@/lib/domain/controle/controleNumero";

export interface ProvisionningFiltres {
  lotId?: string;
  clientId?: string;
  hebergeur?: string;
  statutBascule?: string;
  eligibleExportSeulement?: boolean;
  avecAnomalieSeulement?: boolean;
  recherche?: string;
}

// A ligne is either a full numéro row, or an "équipement seul" row (SPEC §1/§3.1: bornes DECT and
// other devices with no numéro at all are a legitimate row type, not an anomaly). The numéro/
// contrôle fields are null on the latter — there is nothing to bascule and nothing to control.
export interface ProvisionningLigne {
  numeroId: string | null;
  clientId: string;
  clientRaisonSociale: string;
  numeroBrut: string | null;
  numeroNormalise: string | null;
  numerosCourts: string[];
  controleNiveau: NiveauControle | null;
  controleDetail: string | null;
  controleForce: boolean;
  equipementId: string | null;
  equipementLibelle: string | null;
  equipementMacBrut: string | null;
  equipementEligible: boolean;
  utilisateurId: string | null;
  utilisateurNom: string | null;
  hebergeurSource: string;
  hebergeurCible: string;
  statutBascule: string | null;
  dateBascule: Date | null;
  commentaire: string | null;
  exclureExport: boolean;
}

export async function fetchProvisionningLignes(
  filtres: ProvisionningFiltres = {}
): Promise<ProvisionningLigne[]> {
  // Contrôle N° rules 3 and 5 (SPEC §5) are GLOBAL: unicité globale du numéro normalisé sur les
  // lots actifs, unicité des numéros courts au sein d'un même client. Building this context from
  // the filtered `numeros` query below would let a lot/client/search filter silently flip a
  // duplicate's status from ERREUR to OK just because the other half of the duplicate got
  // filtered out of view. This query is deliberately independent of `filtres`.
  const tousNumerosActifs = await prisma.numero.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    select: { clientId: true, numeroNormalise: true, numerosCourts: true },
  });
  const numerosNormalisesActifs = tousNumerosActifs.map((n) => n.numeroNormalise);
  const numerosCourtsParClient = new Map<string, string[]>();
  for (const n of tousNumerosActifs) {
    const liste = numerosCourtsParClient.get(n.clientId) ?? [];
    numerosCourtsParClient.set(n.clientId, [...liste, ...n.numerosCourts]);
  }

  const numeros = await prisma.numero.findMany({
    where: {
      archiveA: null,
      client: {
        archiveA: null,
        ...(filtres.clientId ? { id: filtres.clientId } : {}),
        ...(filtres.lotId ? { lotId: filtres.lotId } : {}),
        ...(filtres.hebergeur ? { hebergeurCible: filtres.hebergeur } : {}),
      },
      ...(filtres.statutBascule ? { statutBascule: filtres.statutBascule } : {}),
      ...(filtres.recherche
        ? {
            // SPEC §3.1: "Recherche globale sur numéro, MAC, utilisateur, raison sociale."
            OR: [
              { numeroBrut: { contains: filtres.recherche, mode: "insensitive" } },
              { client: { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } } },
              {
                utilisateur: {
                  archiveA: null,
                  nom: { contains: filtres.recherche, mode: "insensitive" },
                },
              },
              {
                utilisateur: {
                  archiveA: null,
                  equipements: {
                    some: {
                      archiveA: null,
                      macBrut: { contains: filtres.recherche, mode: "insensitive" },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: { client: true, utilisateur: true },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  const utilisateurIds = numeros
    .map((n) => n.utilisateurId)
    .filter((id): id is string => id !== null);
  // Deliberately unfiltered by `eligibleExportSeulement`: filtering this query by
  // `modele.eligibleExport` made a row with a non-eligible (but present) device look identical to
  // a row with no device at all, producing a false "utilisateur sans équipement" avertissement.
  // Eligibility is tracked per-row below via `equipementEligible` and applied as a post-map filter.
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      utilisateurId: { in: utilisateurIds },
      utilisateur: { archiveA: null },
    },
    include: { modele: true },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });
  const equipementParUtilisateur = new Map(equipements.map((e) => [e.utilisateurId as string, e]));

  const lignesNumero: ProvisionningLigne[] = numeros.map((n) => {
    // `utilisateur` is a to-one include and can't be `where`-filtered by Prisma directly, so an
    // archived Utilisateur's data (name, and anything keyed by their id) must be guarded here
    // rather than at the query level — otherwise it leaks into both the display and the contrôle
    // input.
    const utilisateurActif = n.utilisateur && n.utilisateur.archiveA === null ? n.utilisateur : null;
    const equipement = utilisateurActif ? equipementParUtilisateur.get(utilisateurActif.id) : undefined;

    const resultat = n.controleForce
      ? { niveau: n.controleNiveau, detail: n.controleDetail }
      : evaluerControle(
          {
            numeroNormalise: n.numeroNormalise,
            utilisateurId: utilisateurActif?.id ?? null,
            numerosCourts: n.numerosCourts,
            aEquipement: utilisateurActif ? Boolean(equipement) : undefined,
          },
          {
            numerosNormalisesActifs,
            numerosCourtsDuClient: numerosCourtsParClient.get(n.clientId) ?? [],
          }
        );

    return {
      numeroId: n.id,
      clientId: n.clientId,
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numeroNormalise: n.numeroNormalise,
      numerosCourts: n.numerosCourts,
      controleNiveau: resultat.niveau,
      controleDetail: resultat.detail,
      controleForce: n.controleForce,
      equipementId: equipement?.id ?? null,
      equipementLibelle: equipement?.modele?.libelle ?? equipement?.modeleLibelleBrut ?? null,
      equipementMacBrut: equipement?.macBrut ?? null,
      equipementEligible: equipement?.modele?.eligibleExport ?? false,
      utilisateurId: utilisateurActif?.id ?? null,
      utilisateurNom: utilisateurActif?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
      exclureExport: n.exclureExport,
    };
  });

  // "Équipement seul" rows (SPEC §1/§3.1/l.96: bornes DECT, ou tout appareil sans numéro) have no
  // Numero row to attach to at all, so they are invisible to the query above. Mirrors the
  // equivalent orphan-équipement query in lib/repositories/syncRepository.ts. An orphan is either
  // an équipement with no utilisateur, or one whose utilisateur is active but has zero active
  // numéro (equipment attached to a user who has no numéro to attach to is otherwise unreachable).
  // `statutBascule` has no meaning for these rows (there is no bascule to track), so when that
  // filter is active they are excluded rather than shown with a fabricated value.
  const orphanEquipements = filtres.statutBascule
    ? []
    : await prisma.equipement.findMany({
        where: {
          archiveA: null,
          client: {
            archiveA: null,
            ...(filtres.clientId ? { id: filtres.clientId } : {}),
            ...(filtres.lotId ? { lotId: filtres.lotId } : {}),
            ...(filtres.hebergeur ? { hebergeurCible: filtres.hebergeur } : {}),
          },
          OR: [
            { utilisateurId: null },
            { utilisateur: { archiveA: null, numeros: { none: { archiveA: null } } } },
          ],
          ...(filtres.recherche
            ? {
                AND: [
                  {
                    OR: [
                      { macBrut: { contains: filtres.recherche, mode: "insensitive" as const } },
                      {
                        client: {
                          raisonSociale: { contains: filtres.recherche, mode: "insensitive" as const },
                        },
                      },
                      {
                        utilisateur: {
                          archiveA: null,
                          nom: { contains: filtres.recherche, mode: "insensitive" as const },
                        },
                      },
                    ],
                  },
                ],
              }
            : {}),
        },
        include: { client: true, modele: true, utilisateur: true },
        orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
      });

  const lignesEquipementSeul: ProvisionningLigne[] = orphanEquipements.map((e) => {
    const utilisateurActif = e.utilisateur && e.utilisateur.archiveA === null ? e.utilisateur : null;
    return {
      numeroId: null,
      clientId: e.clientId,
      clientRaisonSociale: e.client.raisonSociale,
      numeroBrut: null,
      numeroNormalise: null,
      numerosCourts: [],
      controleNiveau: null,
      controleDetail: null,
      controleForce: false,
      equipementId: e.id,
      equipementLibelle: e.modele?.libelle ?? e.modeleLibelleBrut ?? null,
      equipementMacBrut: e.macBrut,
      equipementEligible: e.modele?.eligibleExport ?? false,
      utilisateurId: utilisateurActif?.id ?? null,
      utilisateurNom: utilisateurActif?.nom ?? null,
      hebergeurSource: e.client.hebergeurSource,
      hebergeurCible: e.client.hebergeurCible,
      statutBascule: null,
      dateBascule: null,
      commentaire: e.commentaire,
      exclureExport: e.exclureExport,
    };
  });

  let lignes: ProvisionningLigne[] = [...lignesNumero, ...lignesEquipementSeul];

  if (filtres.eligibleExportSeulement) {
    lignes = lignes.filter((l) => l.equipementEligible);
  }
  if (filtres.avecAnomalieSeulement) {
    lignes = lignes.filter((l) => l.controleNiveau !== null && l.controleNiveau !== "OK");
  }

  return lignes;
}
