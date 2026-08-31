// Prestataires externes d'un client (alarme, vidéosurveillance, contrôle d'accès, TPE…).
// L'ADV les saisit, le technicien les appelle avant l'intervention : leurs équipements sont
// branchés sur l'accès qu'on remplace et personne d'autre ne sait les reconfigurer.

export const STATUTS_PRESTATAIRE = [
  "A_CONTACTER",
  "CONTACTE",
  "INJOIGNABLE",
  "SANS_OBJET",
] as const;
export type StatutPrestataire = (typeof STATUTS_PRESTATAIRE)[number];

export const LIBELLE_PRESTATAIRE: Record<StatutPrestataire, string> = {
  A_CONTACTER: "À contacter",
  CONTACTE: "Contacté",
  INJOIGNABLE: "Injoignable",
  SANS_OBJET: "Sans objet",
};

// Un prestataire est « traité » quand le technicien a tranché : joint, ou écarté du dossier.
// Injoignable reste un problème ouvert — c'est justement ce qui bloque le jour J.
export function estPrestataireTraite(statut: string): boolean {
  return statut === "CONTACTE" || statut === "SANS_OBJET";
}

// Couleur d'affichage : vert quand c'est réglé, rouge quand le prestataire ne répond pas,
// ambre tant que personne ne l'a appelé.
export function niveauPrestataire(statut: string): "ok" | "attente" | "alerte" {
  if (statut === "CONTACTE" || statut === "SANS_OBJET") return "ok";
  if (statut === "INJOIGNABLE") return "alerte";
  return "attente";
}

// Jours pleins entre aujourd'hui et l'intervention, en ignorant les heures : J-3 doit se
// déclencher le même jour pour tout le monde, quelle que soit l'heure du cron.
export function joursAvant(intervention: Date, maintenant: Date): number {
  const jour = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((jour(intervention) - jour(maintenant)) / 86_400_000);
}

// Faut-il alerter le chef de projet ? Oui dès que l'intervention approche (J-3 ou moins,
// et pas encore passée) et qu'au moins un prestataire n'a pas été traité.
export function doitAlerterChefProjet(
  intervention: Date | null,
  statutsPrestataires: string[],
  maintenant: Date,
  seuilJours = 3
): boolean {
  if (!intervention || statutsPrestataires.length === 0) return false;
  const restants = joursAvant(intervention, maintenant);
  if (restants < 0 || restants > seuilJours) return false;
  return statutsPrestataires.some((s) => !estPrestataireTraite(s));
}
