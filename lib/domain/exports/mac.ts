export const MAC_HEADERS = ["Client (raison sociale)", "Adresse MAC équipement"];

export interface MacSourceRow {
  clientRaisonSociale: string;
  macBrut: string;
  macNormalise: string;
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
