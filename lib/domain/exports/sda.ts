export const SDA_HEADERS = ["Client (raison sociale)", "Numéro à porter"];

export interface SdaSourceRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  ordre: number;
}

export type MotifExclusionNumero = "numéro mobile" | "numéro SIM";

// Seuls les numéros fixes partent en portabilité. Les mobiles (06/07) restent chez leur
// opérateur mobile, et les numéros de SIM data Sewan (identifiants plus longs que 10
// chiffres, ex. 07000008947698) ne sont pas des numéros à porter du tout.
export function motifExclusionNumero(numeroBrut: string): MotifExclusionNumero | null {
  const chiffres = numeroBrut.replace(/\D/g, "");
  if (chiffres.length > 10) return "numéro SIM";
  if (/^0[67]\d{8}$/.test(chiffres)) return "numéro mobile";
  return null;
}

// Order is decided upstream by the repository's SQL `orderBy` (raisonSociale, ordre, id),
// which is the single source of truth so this tab's row order can't disagree with the
// other tabs' Postgres-collation ordering. This function trusts input order and does not
// re-sort it.
export function buildSdaRows(rows: SdaSourceRow[]): string[][] {
  return rows.map((r) => [r.clientRaisonSociale, r.numeroBrut]);
}
