// Statut dérivé de la commande de lien opérateur, pour l'affichage (pastille, filtre).

export type StatutLien = "NON_COMMANDE" | "COMMANDE" | "LIVRE";

export function statutLien(lien: { lienCommande: boolean; lienLivre: boolean }): StatutLien {
  if (lien.lienLivre) return "LIVRE";
  if (lien.lienCommande) return "COMMANDE";
  return "NON_COMMANDE";
}

export const STATUT_LIEN_LABEL: Record<StatutLien, string> = {
  NON_COMMANDE: "Non commandé",
  COMMANDE: "Commandé",
  LIVRE: "Livré",
};
