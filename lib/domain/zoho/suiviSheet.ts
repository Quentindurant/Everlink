// Traduction Everlink → vocabulaire du Zoho Sheet "TABLEAU SUIVI COMMANDES".
// La colonne INSTALLATION du Sheet pilote le code couleur des ADV par mise en forme
// conditionnelle (contains) : NEW jaune, ATT… rose, STAND BY bleu, INSTALLATION vert,
// A SUIVRE orange, PORTA violet, CLOTUREE gris. Il faut donc envoyer LEURS termes,
// pas les libellés d'étape Everlink, sinon la ligne reste blanche.

const ETAPE_VERS_STATUT_SHEET: [RegExp, string][] = [
  [/à qualifier/i, "NEW"],
  [/prévenance/i, "ATT CLIENT"],
  [/contact en cours/i, "ATT CLIENT"],
  [/bloqué/i, "STAND BY"],
  [/rdv planifié/i, "INSTALLATION"],
  [/lien livré/i, "A SUIVRE"],
  [/bascule faite/i, "PORTA"],
  [/post-migration/i, "CLOTUREE"],
];

export function statutSheetPourEtape(libelleEtape: string | null): string {
  if (!libelleEtape) return "NEW";
  for (const [motif, statut] of ETAPE_VERS_STATUT_SHEET) {
    if (motif.test(libelleEtape)) return statut;
  }
  return "NEW";
}

// Les ADV préfixent le client par la semaine de pose : "S31 - AFDAEIM / ESAT".
export function prefixeSemaine(dateIntervention: Date | null): string {
  if (!dateIntervention) return "";
  // Numéro de semaine ISO 8601 (le jeudi de la semaine décide de l'année).
  const d = new Date(Date.UTC(
    dateIntervention.getFullYear(),
    dateIntervention.getMonth(),
    dateIntervention.getDate()
  ));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
  return `S${semaine} - `;
}

// "12 rue des Lilas 78570 CHANTELOUP" → "78570". Première suite de 5 chiffres.
export function extraireCodePostal(adresse: string | null): string {
  if (!adresse) return "";
  const m = adresse.match(/\b(\d{5})\b/);
  return m ? m[1] : "";
}
