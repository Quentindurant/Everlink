import { formaterMac } from "@/lib/domain/normalisation";

export const MAC_HEADERS = ["Client (raison sociale)", "Adresse MAC équipement"];

export interface MacSourceRow {
  clientRaisonSociale: string;
  macBrut: string;
  macNormalise: string;
  // Libellé et marque du modèle. Le libellé alimente la 3e colonne de prévisualisation; la
  // marque + le libellé servent à répartir l'équipement entre l'onglet Téléphonie et l'onglet
  // Réseau (voir estEquipementReseau).
  modeleLibelle?: string | null;
  marque?: string | null;
}

export function buildMacRows(rows: MacSourceRow[]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const r of rows) {
    const key = `${r.clientRaisonSociale} ${r.macNormalise}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([r.clientRaisonSociale, formaterMac(r.macBrut)]);
  }

  return result;
}

// Mêmes lignes, même déduplication et même ordre que buildMacRows, avec le modèle en 3e
// colonne. Sert uniquement à la prévisualisation à l'écran.
export function buildMacPreviewRows(rows: MacSourceRow[]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const r of rows) {
    const key = `${r.clientRaisonSociale} ${r.macNormalise}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([r.clientRaisonSociale, formaterMac(r.macBrut), r.modeleLibelle ?? ""]);
  }

  return result;
}
