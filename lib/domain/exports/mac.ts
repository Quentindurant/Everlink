export const MAC_HEADERS = ["Client (raison sociale)", "Adresse MAC équipement"];

export interface MacSourceRow {
  clientRaisonSociale: string;
  macBrut: string;
  macNormalise: string;
  // Libellé du modèle, pour la prévisualisation à l'écran uniquement (le fichier xlsx reste
  // strictement à 2 colonnes, conforme au template UNYC).
  modeleLibelle?: string | null;
}

export function buildMacRows(rows: MacSourceRow[]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const r of rows) {
    const key = `${r.clientRaisonSociale} ${r.macNormalise}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([r.clientRaisonSociale, r.macBrut]);
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
    result.push([r.clientRaisonSociale, r.macBrut, r.modeleLibelle ?? ""]);
  }

  return result;
}
