// Disponibilité des techniciens. Logique pure, testable, sans Prisma.
// Un technicien est disponible une date donnée s'il n'est pas déjà affecté à une intervention
// ce jour-là, et (si un département est demandé) s'il le couvre ou intervient partout.

export interface TechnicienLite {
  id: string;
  nom: string;
  // Départements couverts (codes). Vide = intervient partout.
  departements: string[];
}

export interface Affectation {
  technicienId: string;
  date: Date | null;
}

export function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function couvre(tech: TechnicienLite, departement: string): boolean {
  // Aucun département renseigné = intervient partout.
  return tech.departements.length === 0 || tech.departements.includes(departement);
}

export function techniciensDisponibles(
  techniciens: TechnicienLite[],
  affectations: Affectation[],
  date: Date,
  departement?: string,
  // Noms de techniciens occupés ce jour-là selon une source externe (Zoho Sheet), déjà
  // normalisés via normaliserNomTech.
  nomsOccupes?: Set<string>
): TechnicienLite[] {
  const occupes = new Set(
    affectations
      .filter((a) => a.date !== null && memeJour(a.date, date))
      .map((a) => a.technicienId)
  );
  return techniciens.filter((t) => {
    if (occupes.has(t.id)) return false;
    if (nomsOccupes && nomsOccupes.has(normaliserNomTech(t.nom))) return false;
    if (departement && !couvre(t, departement)) return false;
    return true;
  });
}

// Nom de technicien normalisé pour rapprocher l'app et le Zoho Sheet (casse, accents, espaces).
export function normaliserNomTech(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export interface AffectationZoho {
  nomTech: string;
  // Date telle qu'écrite dans le Sheet: "DD/MM" ou "DD/MM/YYYY".
  date: string;
}

// Ensemble des noms de techniciens (normalisés) occupés à la date cible d'après le Zoho Sheet.
// On compare au jour/mois près (l'onglet est mensuel, l'année est implicite).
export function nomsTechOccupes(affectations: AffectationZoho[], cible: Date): Set<string> {
  const jour = cible.getDate();
  const mois = cible.getMonth() + 1;
  const out = new Set<string>();
  for (const a of affectations) {
    if (!a.nomTech.trim()) continue;
    const m = a.date.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!m) continue;
    if (parseInt(m[1], 10) === jour && parseInt(m[2], 10) === mois) {
      out.add(normaliserNomTech(a.nomTech));
    }
  }
  return out;
}
