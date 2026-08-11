import { prisma } from "@/lib/prisma";

export interface TelephoneUtilisateurLigne {
  utilisateurId: string;
  utilisateurNom: string;
  clientId: string;
  clientRaisonSociale: string;
  // Tech qui s'est attribué le client (email), null si personne.
  clientAttribueA: string | null;
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
}

export async function fetchTelephoneGrille(filtres: {
  clientId?: string;
  recherche?: string;
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
          select: { id: true, raisonSociale: true, dateIntervention: true, telephoneAttribueA: true },
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
          select: { macBrut: true, modele: { select: { libelle: true } } },
        },
      },
      // Même ordre que le Provisionning: interventions planifiées les plus proches d'abord.
      orderBy: [
        { client: { dateIntervention: { sort: "asc", nulls: "last" } } },
        { client: { raisonSociale: "asc" } },
        { ordre: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  return {
    etapes: etapes.map((e) => ({ id: e.id, libelle: e.libelle })),
    valeursStatut: valeurs.map((v) => v.valeur),
    utilisateurs: utilisateurs.map((u) => ({
      utilisateurId: u.id,
      utilisateurNom: u.nom,
      clientId: u.client.id,
      clientRaisonSociale: u.client.raisonSociale,
      clientAttribueA: u.client.telephoneAttribueA,
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
