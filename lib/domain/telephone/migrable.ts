// Quand un technicien peut-il commencer à migrer un client ?
//
// Préconfigurer trop tôt casse la joignabilité du client côté Sewan : le dossier ne doit pas
// être touché avant l'un de ces deux feux verts, le premier qui arrive :
//   - l'ADV a posé le statut INSTALLATION dans le tableau de suivi ;
//   - l'intervention est à trois jours ou moins.
//
// Un dossier sans date ni statut n'est pas migrable : rien ne dit qu'il est prêt.

import { joursAvant } from "@/lib/domain/prestataires/statuts";

/** Nombre de jours avant l'intervention à partir duquel la migration est ouverte. */
export const SEUIL_MIGRATION_JOURS = 3;

const STATUT_FEU_VERT = "INSTALLATION";

export type RaisonMigrable = "statut_adv" | "intervention_proche" | null;

export interface EtatMigration {
  migrable: boolean;
  raison: RaisonMigrable;
  /** Jours restants avant l'ouverture ; null si déjà ouvert ou si aucune date connue. */
  joursAvantOuverture: number | null;
}

export function etatMigration(
  statutSuivi: string | null,
  dateIntervention: Date | null,
  maintenant = new Date()
): EtatMigration {
  // Le statut ADV prime : il ouvre la migration même sans date d'intervention posée.
  if ((statutSuivi ?? "").trim().toUpperCase() === STATUT_FEU_VERT) {
    return { migrable: true, raison: "statut_adv", joursAvantOuverture: null };
  }

  if (!dateIntervention) {
    return { migrable: false, raison: null, joursAvantOuverture: null };
  }

  const restants = joursAvant(dateIntervention, maintenant);
  if (restants <= SEUIL_MIGRATION_JOURS) {
    // Inclut les interventions passées : le dossier reste ouvert tant qu'il n'est pas fini.
    return { migrable: true, raison: "intervention_proche", joursAvantOuverture: null };
  }
  return {
    migrable: false,
    raison: null,
    joursAvantOuverture: restants - SEUIL_MIGRATION_JOURS,
  };
}

// Date à laquelle la migration s'ouvrira, pour l'afficher au technicien.
export function dateOuvertureMigration(dateIntervention: Date | null): Date | null {
  if (!dateIntervention) return null;
  const d = new Date(dateIntervention);
  d.setDate(d.getDate() - SEUIL_MIGRATION_JOURS);
  return d;
}
