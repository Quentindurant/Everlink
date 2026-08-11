// Un poste est « résolu » pour une étape quand elle est faite… ou qu'elle ne s'applique
// pas (« Aucun » / « Sans objet ») : la jauge d'avancement compte les deux, sinon un
// client avec des postes sans SVI ne pourrait jamais atteindre 100 %.
export const STATUTS_ETAPE_RESOLUS = ["Fait", "Aucun", "Sans objet"];

export function estEtapeResolue(statut: string | undefined | null): boolean {
  return !!statut && STATUTS_ETAPE_RESOLUS.includes(statut);
}
