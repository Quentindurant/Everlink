// Substitution de variables dans les templates de mail. Logique pure, testable.

export interface VariablesMail {
  civilite_nom: string;
  nom_client: string;
  filiale: string;
  adresse: string;
  date: string;
  creneau: string;
  numero_gc: string;
  /** Boîte mail de migration de la filiale, à qui le client répond. */
  mail_migration: string;
  /** Interlocuteur présent sur site le jour J : « Prénom Nom — téléphone ». */
  contact_site: string;
}

export const VARIABLES_DISPONIBLES: (keyof VariablesMail)[] = [
  "civilite_nom",
  "nom_client",
  "filiale",
  "adresse",
  "date",
  "creneau",
  "numero_gc",
  "mail_migration",
  "contact_site",
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

// « Prénom Nom — téléphone » pour la ligne « Contact sur site » des confirmations. Le mobile
// prime : c'est le numéro qu'on appelle le jour J, pas le standard.
export function contactSite(client: {
  contactNom: string | null;
  contactPrenom: string | null;
  contactFixe?: string | null;
  contactMobile?: string | null;
}): string {
  const nom = [client.contactPrenom, client.contactNom].filter(Boolean).join(" ").trim();
  const tel = (client.contactMobile || client.contactFixe || "").trim();
  if (nom && tel) return `${nom} — ${tel}`;
  return nom || tel;
}
