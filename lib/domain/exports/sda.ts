export const SDA_HEADERS = ["Client (raison sociale)", "Numéro à porter"];

export interface SdaSourceRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  ordre: number;
}

export function buildSdaRows(rows: SdaSourceRow[]): string[][] {
  return [...rows]
    .sort((a, b) => {
      const byName = a.clientRaisonSociale.localeCompare(b.clientRaisonSociale, "fr");
      return byName !== 0 ? byName : a.ordre - b.ordre;
    })
    .map((r) => [r.clientRaisonSociale, r.numeroBrut]);
}
