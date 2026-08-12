// Nom lisible d'un compte à partir de son email : le nom saisi à la création si on le
// connaît, sinon la partie locale de l'adresse (compte supprimé ou email hors annuaire).
export function nomCompte(email: string | null, noms: Record<string, string> = {}): string {
  if (!email) return "—";
  return noms[email] ?? email.split("@")[0];
}
