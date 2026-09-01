// Les Panasonic se traitent autrement que les Yealink : leur reset passe par une combinaison
// au clavier, et chaque poste a son propre fichier d'autoprovision nommé d'après son modèle
// et sa MAC. Les autres marques utilisent l'URL générique renseignée dans l'étape dédiée.

export function estPanasonic(marque: string | null | undefined): boolean {
  return (marque ?? "").trim().toLowerCase() === "panasonic";
}

// Reset usine d'un poste Panasonic, à faire poste par poste avant l'autoprovision.
export const RESET_PANASONIC = [
  "Appuyer sur la touche MENU",
  "Aller dans System Settings (Paramètres système)",
  "Taper la combinaison #136 sur le clavier",
  "Sélectionner Yes (Oui) et valider avec OK",
] as const;
