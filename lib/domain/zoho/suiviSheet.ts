// Traduction Everlink → vocabulaire du Zoho Sheet "TABLEAU SUIVI COMMANDES".
// La colonne INSTALLATION du Sheet pilote le code couleur des ADV par mise en forme
// conditionnelle (contains) : NEW jaune, ATT… rose, STAND BY bleu, INSTALLATION vert,
// A SUIVRE orange, PORTA violet, CLOTUREE gris. Il faut donc envoyer LEURS termes,
// pas les libellés d'étape Everlink, sinon la ligne reste blanche.

// Statuts du suivi ADV, dans l'ordre du cycle de vie d'un dossier, avec la couleur de la
// mise en forme conditionnelle du Sheet (relevée sur l'export du classeur). Ces couleurs
// alimentent aussi les pastilles de l'app : mêmes repères visuels des deux côtés.
export const STATUTS_SUIVI: { statut: string; couleur: string }[] = [
  { statut: "NEW", couleur: "#FFFF00" },
  { statut: "A PLANIFIER", couleur: "#13ED0C" },
  { statut: "ATT CLIENT", couleur: "#F8B5C8" },
  { statut: "ATT TECH", couleur: "#F8B5C8" },
  { statut: "ATT PARTE", couleur: "#F8B5C8" },
  { statut: "A SUIVRE", couleur: "#FFA600" },
  { statut: "STAND BY", couleur: "#85C1E9" },
  { statut: "COLLECTE", couleur: "#F9E79F" },
  { statut: "TECHNIQUE", couleur: "#F1C40F" },
  { statut: "STAGING", couleur: "#F8B5C8" },
  { statut: "INSTALLATION", couleur: "#9BDEB4" },
  { statut: "OPER", couleur: "#EBDEF0" },
  { statut: "PORTA", couleur: "#C39BD3" },
  { statut: "PV", couleur: "#763E8D" },
  { statut: "CLOTUREE", couleur: "#A6A6A6" },
  { statut: "ANNULEE", couleur: "#FF0000" },
];

export function couleurStatutSuivi(statut: string): string {
  return STATUTS_SUIVI.find((s) => s.statut === statut)?.couleur ?? "#A6A6A6";
}

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
