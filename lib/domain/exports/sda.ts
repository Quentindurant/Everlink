export const SDA_HEADERS = ["Client (raison sociale)", "Numéro à porter"];

export interface SdaSourceRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  ordre: number;
}

// Order is decided upstream by the repository's SQL `orderBy` (raisonSociale, ordre, id),
// which is the single source of truth so this tab's row order can't disagree with the
// other tabs' Postgres-collation ordering. This function trusts input order and does not
// re-sort it.
export function buildSdaRows(rows: SdaSourceRow[]): string[][] {
  return rows.map((r) => [r.clientRaisonSociale, r.numeroBrut]);
}
