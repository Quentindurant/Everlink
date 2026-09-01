// URL d'autoprovision UNYC d'un poste PANASONIC : chaque poste a son propre fichier, nommé
// d'après son modèle et sa MAC. Forme attendue :
//   https://titan.eqinoxe.com/sip-ps/{MODEL}-{MAC}.cfg
// Les autres marques (Yealink…) utilisent l'URL générique du serveur, sans nom de fichier :
// leur donner un lien personnalisé serait faux.
//
// Le modèle vient du catalogue ("Yealink T54W"), la MAC de l'équipement, écrite tantôt
// "80:5E:0C:D1:A6:4A" tantôt "805E0CD1A64A" selon la source d'import. On normalise les deux.

import { estPanasonic } from "./panasonic";

export const BASE_AUTOPROVISION = "https://titan.eqinoxe.com/sip-ps";

// "Yealink T54W" → "T54W" ; "Panasonic TGP600" → "TGP600". La marque n'entre pas dans le
// nom de fichier, seul le modèle compte.
export function modelePourAutoprovision(libelle: string): string {
  const mots = libelle.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "";
  // Un libellé sans marque ("T54W") reste tel quel ; sinon on retire le premier mot.
  return (mots.length === 1 ? mots[0] : mots.slice(1).join("")).toUpperCase();
}

// MAC en majuscules sans séparateur, telle qu'attendue dans le nom de fichier.
export function macPourAutoprovision(mac: string): string {
  return mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

// null dès que l'URL personnalisée n'a pas lieu d'être : marque autre que Panasonic, ou
// absence de MAC (softphone, combiné DECT dont l'identifiant n'est pas une MAC).
export function urlAutoprovision(
  marque: string | null,
  libelleModele: string | null,
  mac: string | null
): string | null {
  if (!estPanasonic(marque)) return null;
  const modele = modelePourAutoprovision(libelleModele ?? "");
  const m = macPourAutoprovision(mac ?? "");
  if (!modele || m.length !== 12) return null;
  return `${BASE_AUTOPROVISION}/${modele}-${m}.cfg`;
}
