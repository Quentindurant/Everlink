// Déclinaison pastel d'une couleur d'étape venue du seed (hex arbitraire).
// Style badge du design system v2: fond doux, texte foncé teinté, point saturé.
export function pastelBg(couleur: string): string {
  return `color-mix(in oklab, ${couleur} 14%, white)`;
}

export function pastelFg(couleur: string): string {
  return `color-mix(in oklab, ${couleur} 58%, oklch(0.3 0.015 240))`;
}
