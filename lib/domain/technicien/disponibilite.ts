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
  departement?: string
): TechnicienLite[] {
  const occupes = new Set(
    affectations
      .filter((a) => a.date !== null && memeJour(a.date, date))
      .map((a) => a.technicienId)
  );
  return techniciens.filter((t) => {
    if (occupes.has(t.id)) return false;
    if (departement && !couvre(t, departement)) return false;
    return true;
  });
}
