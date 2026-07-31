import { prisma } from "@/lib/prisma";
import { evaluerControle, type NiveauControle } from "@/lib/domain/controle/controleNumero";
import { normaliserNumero } from "@/lib/domain/normalisation";

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
              // Une recherche saisie avec des séparateurs ("01 80 87 33 45", "+33180873345") ne
              // matche pas numeroBrut tel quel: on interroge aussi la forme normalisée.
              {
                numeroNormalise: {
                  contains: normaliserNumero(filtres.recherche),
                  mode: "insensitive",
                },
              },
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
  // Un utilisateur peut porter plusieurs équipements (poste fixe + combiné DECT, par exemple).
  // N'en garder qu'un masquait les autres MAC et faussait le filtre d'éligibilité, qui est une
  // propriété de l'appareil, pas de l'utilisateur. On garde donc la liste complète, ordonnée.
  const equipementsParUtilisateur = new Map<string, typeof equipements>();
  for (const e of equipements) {
    const liste = equipementsParUtilisateur.get(e.utilisateurId as string) ?? [];
    liste.push(e);
    equipementsParUtilisateur.set(e.utilisateurId as string, liste);
  }

  const lignesNumero: ProvisionningLigne[] = numeros.flatMap((n): ProvisionningLigne[] => {
    // `utilisateur` is a to-one include and can't be `where`-filtered by Prisma directly, so an
    // archived Utilisateur's data (name, and anything keyed by their id) must be guarded here
    // rather than at the query level — otherwise it leaks into both the display and the contrôle
    // input.
    const utilisateurActif = n.utilisateur && n.utilisateur.archiveA === null ? n.utilisateur : null;
    const equipementsDuNumero = utilisateurActif
      ? (equipementsParUtilisateur.get(utilisateurActif.id) ?? [])
      : [];

    const resultat = n.controleForce
      ? { niveau: n.controleNiveau, detail: n.controleDetail }
      : evaluerControle(
          {
            numeroNormalise: n.numeroNormalise,
            utilisateurId: utilisateurActif?.id ?? null,
            numerosCourts: n.numerosCourts,
            aEquipement: utilisateurActif ? equipementsDuNumero.length > 0 : undefined,
          },
          {
            numerosNormalisesActifs,
            numerosCourtsDuClient: numerosCourtsParClient.get(n.clientId) ?? [],
          }
        );

    const base = {
      clientId: n.clientId,
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numeroNormalise: n.numeroNormalise,
      numerosCourts: n.numerosCourts,
      controleNiveau: resultat.niveau,
      controleDetail: resultat.detail,
      controleForce: n.controleForce,
      utilisateurId: utilisateurActif?.id ?? null,
      utilisateurNom: utilisateurActif?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
      exclureExport: n.exclureExport,
    };

    if (equipementsDuNumero.length === 0) {
      return [
        {
          ...base,
          numeroId: n.id,
          equipementId: null,
          equipementLibelle: null,
          equipementMacBrut: null,
          equipementEligible: false,
        },
      ];
    }

    // Seule la première ligne porte `numeroId`: c'est elle qui rend les champs du numéro
    // éditables, sélectionnables et comptés. Les suivantes répètent l'affichage mais ne peuvent
    // pas écrire deux fois le même Numero, ce qui rendrait la sélection et les compteurs faux.
    return equipementsDuNumero.map((e, index) => ({
      ...base,
      numeroId: index === 0 ? n.id : null,
      equipementId: e.id,
      equipementLibelle: e.modele?.libelle ?? e.modeleLibelleBrut ?? null,
      equipementMacBrut: e.macBrut,
      equipementEligible: e.modele?.eligibleExport ?? false,
    }));
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

// SPEC §5: "Le contrôle est recalculé à l'écriture." `fetchProvisionningLignes` recalcule à la
// lecture pour que la grille soit vive, mais tout consommateur direct de la base (la synchro
// Google Sheets en tête) lit `controleNiveau` stocké. Sans cette persistance, il publie le
// défaut "OK" pour toutes les lignes.
export async function recalculerControle(numeroId: string): Promise<void> {
  const numero = await prisma.numero.findUnique({
    where: { id: numeroId },
    include: { utilisateur: true },
  });
  // Un contrôle forcé est une décision humaine tracée (motif, auteur, date): jamais écrasée.
  if (!numero || numero.controleForce) return;

  const tousNumerosActifs = await prisma.numero.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    select: { clientId: true, numeroNormalise: true, numerosCourts: true },
  });
  const utilisateurActif =
    numero.utilisateur && numero.utilisateur.archiveA === null ? numero.utilisateur : null;
  const aEquipement = utilisateurActif
    ? (await prisma.equipement.count({
        where: { archiveA: null, utilisateurId: utilisateurActif.id },
      })) > 0
    : undefined;

  const resultat = evaluerControle(
    {
      numeroNormalise: numero.numeroNormalise,
      utilisateurId: utilisateurActif?.id ?? null,
      numerosCourts: numero.numerosCourts,
      aEquipement,
    },
    {
      numerosNormalisesActifs: tousNumerosActifs.map((n) => n.numeroNormalise),
      numerosCourtsDuClient: tousNumerosActifs
        .filter((n) => n.clientId === numero.clientId)
        .flatMap((n) => n.numerosCourts),
    }
  );
  await prisma.numero.update({
    where: { id: numeroId },
    data: { controleNiveau: resultat.niveau, controleDetail: resultat.detail },
  });
}

export async function listLotsActifs(): Promise<{ id: string; nom: string }[]> {
  return prisma.lot.findMany({
    where: { clos: false },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}

export async function listClientsActifs(): Promise<{ id: string; raisonSociale: string }[]> {
  return prisma.client.findMany({
    where: { archiveA: null },
    select: { id: true, raisonSociale: true },
    orderBy: { raisonSociale: "asc" },
  });
}

// Clients actifs qui n'ont encore aucune ligne dans la grille (typiquement issus d'un import
// Monday: le client existe, mais ni utilisateur ni numéro ni équipement). Sans ça ils
// n'apparaissent nulle part où l'on puisse les compléter. On respecte les filtres compatibles
// avec un client vide (lot, client, recherche sur la raison sociale) et on exclut ceux déjà
// présents dans la grille.
export async function fetchClientsSansLignes(
  clientIdsPresents: string[],
  filtres: { lotId?: string; clientId?: string; recherche?: string } = {}
): Promise<{ id: string; raisonSociale: string }[]> {
  return prisma.client.findMany({
    where: {
      archiveA: null,
      id: { notIn: clientIdsPresents.length > 0 ? clientIdsPresents : ["__none__"] },
      ...(filtres.clientId ? { id: filtres.clientId } : {}),
      ...(filtres.lotId ? { lotId: filtres.lotId } : {}),
      ...(filtres.recherche
        ? { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, raisonSociale: true },
    orderBy: { raisonSociale: "asc" },
  });
}

// SPEC §8: la bascule des numéros est une liste de valeurs, pas du texte libre.
export async function listValeursStatutBascule(): Promise<string[]> {
  const valeurs = await prisma.listeValeur.findMany({
    where: { categorie: "STATUT_BASCULE", actif: true },
    select: { valeur: true },
    orderBy: { ordre: "asc" },
  });
  return valeurs.map((v) => v.valeur);
}
