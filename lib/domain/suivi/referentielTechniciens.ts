// Référentiel commun des techniciens : les choix (« choices ») de la colonne SELECT
// `nom_tech` du tableau de suivi, gérés dans les Paramètres du tableau, sont LA liste
// de référence. L'app y contribue au push (un technicien poussé absent de la liste y
// est ajouté) et en redescend les absents au pull (création dans l'annuaire).
// Règles pures et testables ici ; les appels réseau vivent dans lib/suivi.
import { normaliserNomTech } from "@/lib/domain/technicien/disponibilite";

/** Clé de la colonne du tableau qui porte le référentiel. */
export const CLE_COLONNE_NOM_TECH = "nom_tech";

/**
 * Écarte les cases de service (« / », « - ») et saisies parasites du tableau : un nom
 * compte au moins deux lettres consécutives. Même règle que la création automatique
 * de techniciens du pull.
 */
export function estNomPlausible(nom: string): boolean {
  const t = nom.trim();
  return t.length >= 2 && /\p{L}{2,}/u.test(t);
}

/**
 * Le nom figure-t-il déjà dans la liste ? Insensible à la casse, aux espaces et aux
 * accents (le tableau contient « Bruce », « BRUCE » et « bruce » pour la même personne).
 */
export function nomDejaDansChoix(labels: string[], nom: string): boolean {
  const n = normaliserNomTech(nom);
  if (!n) return false;
  return labels.some((label) => normaliserNomTech(label) === n);
}

/**
 * Noms du référentiel à créer dans l'annuaire : plausibles, absents des techniciens
 * existants (comparaison insensible casse/espaces/accents) et dédoublonnés entre eux.
 * Le libellé d'origine (trimé) est conservé tel quel — les noms ne sont jamais réécrits.
 */
export function techniciensManquantsDuReferentiel(labels: string[], nomsExistants: string[]): string[] {
  const connus = new Set(nomsExistants.map(normaliserNomTech));
  const manquants: string[] = [];
  for (const label of labels) {
    const nom = label.trim();
    if (!estNomPlausible(nom)) continue;
    const n = normaliserNomTech(nom);
    if (connus.has(n)) continue;
    connus.add(n);
    manquants.push(nom);
  }
  return manquants;
}
