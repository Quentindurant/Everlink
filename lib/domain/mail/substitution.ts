// Substitution de variables dans les templates de mail. Logique pure, testable.

export interface VariablesMail {
  civilite_nom: string;
  nom_client: string;
  filiale: string;
  adresse: string;
  date: string;
  creneau: string;
  numero_gc: string;
}

export const VARIABLES_DISPONIBLES: (keyof VariablesMail)[] = [
  "civilite_nom",
  "nom_client",
  "filiale",
  "adresse",
  "date",
  "creneau",
  "numero_gc",
];

// Remplace chaque {cle} par sa valeur. Une clé absente des variables (connue ou non) est
// laissée telle quelle: on préfère un placeholder visible à un trou silencieux dans un mail
// envoyé au client.
export function substituer(gabarit: string, variables: Partial<VariablesMail>): string {
  return gabarit.replace(/\{([a-z_]+)\}/g, (match, cle: string) => {
    const valeur = variables[cle as keyof VariablesMail];
    return valeur !== undefined && valeur !== "" ? valeur : match;
  });
}
