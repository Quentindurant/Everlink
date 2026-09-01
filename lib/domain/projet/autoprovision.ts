// URL d'autoprovision UNYC d'un poste : le chef de projet la colle dans le téléphone après
// reset. Forme attendue : https://titan.eqinoxe.com/sip-ps/{MODEL}-{MAC}.cfg
//
// Le modèle vient du catalogue ("Yealink T54W"), la MAC de l'équipement, écrite tantôt
// "80:5E:0C:D1:A6:4A" tantôt "805E0CD1A64A" selon la source d'import. On normalise les deux.

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

// null quand on ne peut pas construire une URL fiable : sans MAC (softphone, poste non
// renseigné) il n'y a pas de fichier de configuration à pointer.
export function urlAutoprovision(libelleModele: string | null, mac: string | null): string | null {
  const modele = modelePourAutoprovision(libelleModele ?? "");
  const m = macPourAutoprovision(mac ?? "");
  if (!modele || m.length !== 12) return null;
  return `${BASE_AUTOPROVISION}/${modele}-${m}.cfg`;
}
