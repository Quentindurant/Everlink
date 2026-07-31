// Logique pure du parcours de migration client. Sans dépendance Prisma pour être testable.

export interface EtapeMigrationLite {
  id: string;
  libelle: string;
  ordre: number;
  couleur: string;
  estBloquant: boolean;
}

// Étape à partir de laquelle un client est considéré comme basculé.
export const ETAPE_TERMINALE = "Bascule faite";

// Seuil de tentatives de contact au-delà duquel on suggère de passer le client en Bloqué
// (règle CR: tenter de joindre pendant 3 jours ouvrés).
export const SEUIL_TENTATIVES = 3;

// Un client est basculé si son étape courante est au niveau de l'étape terminale ou au-delà
// (par ordre). Si le référentiel ne contient pas l'étape terminale, on ne peut rien affirmer:
// on renvoie false plutôt que de deviner.
export function estBasculee(
  etape: EtapeMigrationLite | null,
  etapes: EtapeMigrationLite[]
): boolean {
  if (!etape) return false;
  const terminale = etapes.find((e) => e.libelle === ETAPE_TERMINALE);
  if (!terminale) return false;
  return etape.ordre >= terminale.ordre;
}

// On ne suggère le blocage que si le client n'est ni déjà bloqué, ni déjà basculé:
// dans ces deux cas, insister n'a pas de sens.
export function doitSuggererBloque(
  nbTentatives: number,
  etapeCourante: EtapeMigrationLite | null
): boolean {
  if (nbTentatives < SEUIL_TENTATIVES) return false;
  if (!etapeCourante) return true;
  if (etapeCourante.estBloquant) return false;
  if (etapeCourante.libelle === ETAPE_TERMINALE || etapeCourante.libelle === "Post-migration J+7")
    return false;
  return true;
}
