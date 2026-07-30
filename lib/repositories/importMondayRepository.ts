import { prisma } from "@/lib/prisma";
import type { MondayLigne } from "@/lib/domain/import/monday";

// Décision de l'opérateur pour chaque ligne "à rapprocher": id d'un client existant,
// "creer" pour un nouveau client, ou "ignorer".
export type DecisionRapprochement = string;

export interface ApplicationResultat {
  crees: number;
  misAJour: number;
  ignores: number;
  modelesCrees: string[];
  erreurs: string[];
}

// Seuls les champs issus de Monday sont écrits (SPEC §4): jamais hébergeurs, statuts de
// bascule ni commentaires saisis dans l'application. Le commentaire Monday reste dans
// mondayRaw pour ne pas écraser une saisie locale.
function champsMondayDe(ligne: MondayLigne) {
  return {
    codeMonday: ligne.codeMonday,
    filiale: ligne.filiale,
    scenario: ligne.scenario,
    adresse: ligne.adresse,
    dateIntervention: ligne.dateIntervention,
    clientVip: ligne.clientVip,
    typeIntervention: ligne.typeIntervention,
    statutMonday: ligne.statutMonday,
    nbPostesAnnonce: ligne.nbPostesAnnonce,
    contactNom: ligne.contactNom,
    contactPrenom: ligne.contactPrenom,
    contactFixe: ligne.contactFixe,
    contactMobile: ligne.contactMobile,
    contactEmail: ligne.contactEmail,
    technoLien: ligne.technoLien,
    debit: ligne.debit,
    modeleCpe: ligne.modeleCpe,
    departement: ligne.departement,
    postesDeployesRaw: ligne.postesDeployes.join(", ") || null,
    mondayRaw: JSON.parse(
      JSON.stringify({ ...ligne.champsBruts, Commentaire: ligne.commentaire })
    ),
  };
}

async function lotIdPourNom(nom: string | null): Promise<string | null> {
  if (!nom) return null;
  const lot = await prisma.lot.upsert({
    where: { nom },
    update: {},
    create: { nom },
  });
  return lot.id;
}

export async function appliquerImport(
  aCreer: MondayLigne[],
  aMettreAJour: { ligne: MondayLigne; clientId: string }[],
  aRapprocher: { ligne: MondayLigne; decision: DecisionRapprochement }[],
  modelesInconnus: string[],
  nomFichier: string,
  tailleOctets: number | null,
  auteurId: string | null
): Promise<ApplicationResultat> {
  const resultat: ApplicationResultat = {
    crees: 0,
    misAJour: 0,
    ignores: 0,
    modelesCrees: [],
    erreurs: [],
  };

  // Catalogue: chaque libellé inconnu crée un ModeleEquipement, éligibilité déduite de la
  // marque (Yealink vrai, autre faux), signalé pour validation humaine (SPEC §4).
  for (const libelle of modelesInconnus) {
    const marque = libelle.trim().split(/\s+/)[0] || libelle;
    const existant = await prisma.modeleEquipement.findUnique({ where: { libelle } });
    if (!existant) {
      await prisma.modeleEquipement.create({
        data: {
          libelle,
          marque,
          eligibleExport: marque.toLowerCase() === "yealink",
          alias: [],
        },
      });
      resultat.modelesCrees.push(libelle);
    }
  }

  const creerClient = async (ligne: MondayLigne) => {
    const lotId = await lotIdPourNom(ligne.lotNom);
    await prisma.client.create({
      data: {
        raisonSociale: ligne.raisonSociale,
        cleRapprochement: ligne.raisonSociale.trim().replace(/\s+/g, " ").toUpperCase(),
        lotId,
        ...champsMondayDe(ligne),
      },
    });
    resultat.crees++;
  };

  const mettreAJourClient = async (ligne: MondayLigne, clientId: string) => {
    const lotId = await lotIdPourNom(ligne.lotNom);
    await prisma.client.update({
      where: { id: clientId },
      data: {
        ...champsMondayDe(ligne),
        // Le lot n'est réaffecté que si le fichier en fournit un.
        ...(lotId ? { lotId } : {}),
      },
    });
    resultat.misAJour++;
  };

  for (const ligne of aCreer) {
    try {
      await creerClient(ligne);
    } catch (e) {
      resultat.erreurs.push(`${ligne.raisonSociale} : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }
  for (const { ligne, clientId } of aMettreAJour) {
    try {
      await mettreAJourClient(ligne, clientId);
    } catch (e) {
      resultat.erreurs.push(`${ligne.raisonSociale} : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }
  for (const { ligne, decision } of aRapprocher) {
    try {
      if (decision === "ignorer") {
        resultat.ignores++;
      } else if (decision === "creer") {
        await creerClient(ligne);
      } else {
        await mettreAJourClient(ligne, decision);
      }
    } catch (e) {
      resultat.erreurs.push(`${ligne.raisonSociale} : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  await prisma.importRun.create({
    data: {
      type: "MONDAY",
      nomFichier,
      tailleOctets,
      succes: resultat.erreurs.length === 0,
      rapport: JSON.parse(JSON.stringify(resultat)),
      auteurId,
    },
  });

  return resultat;
}

export async function fetchImportRuns(limit = 20) {
  return prisma.importRun.findMany({
    where: { type: "MONDAY" },
    include: { auteur: { select: { email: true } } },
    orderBy: { creeLe: "desc" },
    take: limit,
  });
}
