export const CLIENTS_HEADERS = [
  "Raison sociale",
  "Lot",
  "Nb numéros",
  "MAC saisis",
  "MAC distincts",
  "Bascules faites",
  "Statut global",
  "Scénario",
  "Adresse",
  "Contact",
  "Nb postes annoncé (Monday)",
  "Écart postes/équipements",
];

export interface ClientSyncRow {
  raisonSociale: string;
  lotNom: string | null;
  nbNumeros: number;
  nbMacSaisis: number;
  nbMacDistincts: number;
  nbBasculesFaites: number;
  statutGlobal: string;
  scenario: string | null;
  adresse: string | null;
  contactNom: string | null;
  contactPrenom: string | null;
  nbPostesAnnonce: number | null;
  nbEquipements: number;
}

function contact(nom: string | null, prenom: string | null): string {
  return [nom, prenom].filter(Boolean).join(" ");
}

export function buildClientsRows(clients: ClientSyncRow[]): string[][] {
  return clients.map((c) => [
    c.raisonSociale,
    c.lotNom ?? "",
    String(c.nbNumeros),
    String(c.nbMacSaisis),
    String(c.nbMacDistincts),
    String(c.nbBasculesFaites),
    c.statutGlobal,
    c.scenario ?? "",
    c.adresse ?? "",
    contact(c.contactNom, c.contactPrenom),
    c.nbPostesAnnonce === null ? "" : String(c.nbPostesAnnonce),
    c.nbPostesAnnonce === null ? "" : String(c.nbPostesAnnonce - c.nbEquipements),
  ]);
}
