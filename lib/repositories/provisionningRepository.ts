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

export interface ProvisionningLigne {
  numeroId: string;
  clientId: string;
  clientRaisonSociale: string;
  numeroBrut: string;
  numeroNormalise: string;
  numerosCourts: string[];
  controleNiveau: NiveauControle;
  controleDetail: string | null;
  controleForce: boolean;
  equipementId: string | null;
  equipementLibelle: string | null;
  equipementMacBrut: string | null;
  utilisateurId: string | null;
  utilisateurNom: string | null;
  hebergeurSource: string;
  hebergeurCible: string;
  statutBascule: string;
  dateBascule: Date | null;
  commentaire: string | null;
  exclureExport: boolean;
}

export async function fetchProvisionningLignes(
  filtres: ProvisionningFiltres = {}
): Promise<ProvisionningLigne[]> {
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
            OR: [
              { numeroBrut: { contains: filtres.recherche, mode: "insensitive" } },
              { client: { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } } },
              { utilisateur: { nom: { contains: filtres.recherche, mode: "insensitive" } } },
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
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      utilisateurId: { in: utilisateurIds },
      utilisateur: { archiveA: null },
      ...(filtres.eligibleExportSeulement ? { modele: { eligibleExport: true } } : {}),
    },
    include: { modele: true },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });
  const equipementParUtilisateur = new Map(equipements.map((e) => [e.utilisateurId as string, e]));

  const numerosNormalisesActifs = numeros.map((n) => n.numeroNormalise);
  const numerosCourtsParClient = new Map<string, string[]>();
  for (const n of numeros) {
    const liste = numerosCourtsParClient.get(n.clientId) ?? [];
    numerosCourtsParClient.set(n.clientId, [...liste, ...n.numerosCourts]);
  }

  const lignes: ProvisionningLigne[] = numeros.map((n) => {
    const equipement = n.utilisateurId ? equipementParUtilisateur.get(n.utilisateurId) : undefined;
    const utilisateurActif = n.utilisateur && n.utilisateur.archiveA === null ? n.utilisateur : null;

    const resultat = n.controleForce
      ? { niveau: n.controleNiveau, detail: n.controleDetail }
      : evaluerControle(
          {
            numeroNormalise: n.numeroNormalise,
            utilisateurId: n.utilisateurId,
            numerosCourts: n.numerosCourts,
            aEquipement: n.utilisateurId ? Boolean(equipement) : undefined,
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

  if (filtres.avecAnomalieSeulement) {
    return lignes.filter((l) => l.controleNiveau !== "OK");
  }
  return lignes;
}
