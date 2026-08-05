// Constantes et types du cycle de vie du stock, sans dépendance à Prisma, pour être importables
// aussi bien côté serveur (repository) que client (tableau).

export const STATUTS_STOCK = ["EN_STOCK", "CONFIGURE", "ENVOYE", "INSTALLE", "RETOUR"] as const;
export type StatutStock = (typeof STATUTS_STOCK)[number];

// Statut suivant dans le cycle (null = terminal). Le retour est saisi à part, pas dans le flux.
export const STATUT_SUIVANT: Record<string, StatutStock | null> = {
  EN_STOCK: "CONFIGURE",
  CONFIGURE: "ENVOYE",
  ENVOYE: "INSTALLE",
  INSTALLE: null,
  RETOUR: null,
};

export const LIBELLE_STATUT: Record<string, string> = {
  EN_STOCK: "En stock",
  CONFIGURE: "Configuré",
  ENVOYE: "Envoyé",
  INSTALLE: "Installé",
  RETOUR: "Retour",
};

export interface ArticleStockLigne {
  id: string;
  type: string;
  numeroSerie: string;
  statut: string;
  origine: string;
  etatAppareil: string | null;
  clientFinal: string | null;
  dateReception: string | null;
  dateEnvoi: string | null;
  commentaire: string | null;
}
