import { prisma } from "@/lib/prisma";
import { normaliserNumero, normaliserMac } from "@/lib/domain/normalisation";
import type { SewanUserRow } from "@/lib/domain/import/sewanUsers";

export interface ImportSewanResultat {
  utilisateurs: number;
  numeros: number;
  equipements: number;
  doublons: number;
  modelesCrees: string[];
}

// Résout le ModeleEquipement d'un libellé (exact ou alias, insensible à la casse). Crée le
// modèle s'il est inconnu (éligibilité déduite de la marque, comme l'import Monday) et le
// signale dans le rapport.
async function resoudreModele(
  libelle: string,
  cache: Map<string, string>,
  modelesCrees: string[]
): Promise<string> {
  const cle = libelle.toLowerCase();
  const enCache = cache.get(cle);
  if (enCache) return enCache;

  const existants = await prisma.modeleEquipement.findMany();
  const trouve = existants.find(
    (m) =>
      m.libelle.toLowerCase() === cle ||
      m.alias.some((a) => a.toLowerCase() === cle)
  );
  if (trouve) {
    cache.set(cle, trouve.id);
    return trouve.id;
  }
  const marque = libelle.trim().split(/\s+/)[0] || libelle;
  const cree = await prisma.modeleEquipement.create({
    data: {
      libelle,
      marque,
      eligibleExport: marque.toLowerCase() === "yealink",
      alias: [],
    },
  });
  cache.set(cle, cree.id);
  modelesCrees.push(libelle);
  return cree.id;
}

// Importe les utilisateurs d'un client depuis un export Sewan. Idempotent sur le numéro
// normalisé : une ligne dont le numéro existe déjà (actif) chez ce client est comptée en
// doublon et sautée. `dokoIndices` = indices des lignes pour lesquelles ajouter en plus un
// softphone DOKO.
export async function importUtilisateursSewan(
  clientId: string,
  rows: SewanUserRow[],
  dokoIndices: number[]
): Promise<ImportSewanResultat> {
  const res: ImportSewanResultat = {
    utilisateurs: 0,
    numeros: 0,
    equipements: 0,
    doublons: 0,
    modelesCrees: [],
  };
  const dokoSet = new Set(dokoIndices);
  const cacheModele = new Map<string, string>();

  // Numéros déjà présents chez ce client, pour l'idempotence.
  const existants = await prisma.numero.findMany({
    where: { clientId, archiveA: null },
    select: { numeroNormalise: true },
  });
  const numerosExistants = new Set(existants.map((n) => n.numeroNormalise));

  const dokoModeleId = await prisma.modeleEquipement.findFirst({
    where: { libelle: "DOKO" },
    select: { id: true },
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const numeroNormalise = normaliserNumero(row.numeroBrut);
    if (numerosExistants.has(numeroNormalise)) {
      res.doublons++;
      continue;
    }
    numerosExistants.add(numeroNormalise);

    const utilisateur = await prisma.utilisateur.create({
      data: { clientId, nom: row.nom },
    });
    res.utilisateurs++;

    await prisma.numero.create({
      data: {
        clientId,
        utilisateurId: utilisateur.id,
        numeroBrut: row.numeroBrut,
        numeroNormalise,
        numerosCourts: row.numeroInterne ? [row.numeroInterne] : [],
      },
    });
    res.numeros++;

    // Équipement principal issu du CSV.
    if (row.equipementModele) {
      const modeleId = await resoudreModele(row.equipementModele, cacheModele, res.modelesCrees);
      await prisma.equipement.create({
        data: {
          clientId,
          utilisateurId: utilisateur.id,
          modeleId,
          macBrut: row.equipementMac ?? "",
          macNormalise: normaliserMac(row.equipementMac ?? ""),
        },
      });
      res.equipements++;
    }

    // Softphone DOKO confirmé pour cette ligne (en plus du poste physique).
    if (dokoSet.has(i) && dokoModeleId) {
      await prisma.equipement.create({
        data: {
          clientId,
          utilisateurId: utilisateur.id,
          modeleId: dokoModeleId.id,
          macBrut: "",
          macNormalise: "",
        },
      });
      res.equipements++;
    }
  }

  return res;
}
