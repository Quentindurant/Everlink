// Reconnaissance de l'opérateur d'une carte SIM d'après son numéro, pour le distinguer d'un
// coup d'œil dans le stock : rien ne ressemble plus à une SIM Orange qu'une SIM Bouygues,
// et les deux ne s'installent pas chez le même client.

export type PaletteOperateur = "amber" | "blue" | "red" | "violet";

export interface OperateurSim {
  nom: string;
  /** Teinte du design system, pour la puce affichée à côté du numéro. */
  pal: PaletteOperateur;
}

// Un ICCID français commence par 8933 (89 = télécoms, 33 = France), suivi du code de
// l'émetteur. Ces quatre codes couvrent les opérateurs nationaux.
const EMETTEURS: Record<string, OperateurSim> = {
  "01": { nom: "Orange", pal: "amber" },
  "07": { nom: "Bouygues", pal: "blue" },
  "20": { nom: "SFR", pal: "red" },
  "15": { nom: "Free", pal: "violet" },
};

// Bouygues fournit aussi des cartes sans ICCID : treize chiffres commençant par 27. Ce
// format ne dit pas l'opérateur par lui-même, il est reconnu parce qu'il n'apparaît que là.
const PREFIXE_BOUYGUES_COURT = "27";
const LONGUEUR_BOUYGUES_COURT = 13;

export function operateurSim(numeroSerie: string): OperateurSim | null {
  const n = numeroSerie.replace(/\D/g, "");
  if (!n) return null;

  if (n.startsWith("8933") && n.length >= 6) {
    return EMETTEURS[n.slice(4, 6)] ?? null;
  }
  if (n.length === LONGUEUR_BOUYGUES_COURT && n.startsWith(PREFIXE_BOUYGUES_COURT)) {
    return EMETTEURS["07"];
  }
  // Format inconnu : ne rien affirmer vaut mieux qu'afficher le mauvais opérateur.
  return null;
}

export function estSim(type: string): boolean {
  return type.toUpperCase().includes("SIM");
}
