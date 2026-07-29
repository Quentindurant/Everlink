export interface TelephoneUtilisateurRow {
  clientRaisonSociale: string;
  utilisateurNom: string;
  statutsParEtape: Record<string, string>;
}

export function buildTelephoneHeaders(etapeLibelles: string[]): string[] {
  return ["Client (raison sociale)", "Utilisateur", ...etapeLibelles];
}

export function buildTelephoneRows(
  utilisateurs: TelephoneUtilisateurRow[],
  etapeLibelles: string[]
): string[][] {
  return utilisateurs.map((u) => [
    u.clientRaisonSociale,
    u.utilisateurNom,
    ...etapeLibelles.map((etape) => u.statutsParEtape[etape] ?? "À faire"),
  ]);
}
