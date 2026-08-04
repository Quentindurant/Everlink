import { prisma } from "@/lib/prisma";
import { normaliserMac } from "@/lib/domain/normalisation";
import type { SewanDeviceRow } from "@/lib/domain/import/sewanDevices";

export interface DevicePreviewRow extends SewanDeviceRow {
  // true si un équipement du client porte déjà cette MAC (importé via les users, ou saisi).
  dejaPresent: boolean;
}

// Prévisualisation: marque chaque device comme déjà présent ou nouveau (par MAC normalisée).
export async function previewDevices(
  clientId: string,
  rows: SewanDeviceRow[]
): Promise<DevicePreviewRow[]> {
  const existants = await prisma.equipement.findMany({
    where: { clientId, archiveA: null },
    select: { macNormalise: true },
  });
  const macs = new Set(existants.map((e) => e.macNormalise).filter(Boolean));
  return rows.map((r) => ({ ...r, dejaPresent: macs.has(normaliserMac(r.mac)) }));
}

export interface ImportDevicesResultat {
  crees: number;
  dejaPresents: number;
  modelesCrees: string[];
}

// Importe les devices d'un client. Les MAC déjà présentes (importées via les users) sont
// sautées; les nouvelles sont créées SANS utilisateur ni numéro (équipements orphelins, comme
// les bornes DECT). Les modèles inconnus sont créés ÉLIGIBLES à l'export (ce sont des devices
// à migrer, demandé explicitement), sauf DOKO qui reste non exporté.
export async function importDevicesSewan(
  clientId: string,
  rows: SewanDeviceRow[]
): Promise<ImportDevicesResultat> {
  const res: ImportDevicesResultat = { crees: 0, dejaPresents: 0, modelesCrees: [] };

  const existants = await prisma.equipement.findMany({
    where: { clientId, archiveA: null },
    select: { macNormalise: true },
  });
  const macs = new Set(existants.map((e) => e.macNormalise).filter(Boolean));

  const modeles = await prisma.modeleEquipement.findMany();
  const cache = new Map<string, string>();
  for (const m of modeles) {
    cache.set(m.libelle.toLowerCase(), m.id);
    for (const a of m.alias) cache.set(a.toLowerCase(), m.id);
  }

  const resoudreModele = async (libelle: string): Promise<string> => {
    const cle = libelle.toLowerCase();
    const trouve = cache.get(cle);
    if (trouve) return trouve;
    const marque = libelle.trim().split(/\s+/)[0] || libelle;
    const cree = await prisma.modeleEquipement.create({
      data: {
        libelle,
        marque,
        // Devices à migrer: éligibles à l'export par défaut (DOKO softphone excepté).
        eligibleExport: marque.toLowerCase() !== "doko",
        alias: [],
      },
    });
    cache.set(cle, cree.id);
    res.modelesCrees.push(libelle);
    return cree.id;
  };

  for (const row of rows) {
    const macNormalise = normaliserMac(row.mac);
    if (macNormalise && macs.has(macNormalise)) {
      res.dejaPresents++;
      continue;
    }
    if (macNormalise) macs.add(macNormalise);

    const modeleId = await resoudreModele(row.modele);
    await prisma.equipement.create({
      data: {
        clientId,
        utilisateurId: null,
        modeleId,
        macBrut: row.mac,
        macNormalise,
      },
    });
    res.crees++;
  }

  return res;
}
