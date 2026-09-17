// Les Panasonic se traitent autrement que les Yealink : reset par une combinaison au clavier,
// puis autoprovision à renseigner à la main dans l'interface web du poste. L'URL du fichier de
// configuration est un gabarit unique : c'est le téléphone qui remplace lui-même {MODEL} et
// {MAC}, on ne fabrique donc pas de lien par poste. Les autres marques utilisent l'URL
// générique renseignée dans l'étape dédiée.

export function estPanasonic(marque: string | null | undefined): boolean {
  return (marque ?? "").trim().toLowerCase() === "panasonic";
}

// Reset usine d'un poste Panasonic, à faire poste par poste avant l'autoprovision.
export const RESET_PANASONIC = [
  "Menu > Réglages Système",
  "Mettre en surbrillance STATUS, sans cliquer dessus",
  "Composer #136",
  "Sélectionner OUI à l'écran du téléphone",
] as const;

// Activation de l'interface web du poste, nécessaire pour saisir l'autoprovision.
export const INTERFACE_WEB_PANASONIC = [
  "Menu > Réglages Système > Display > Interface WEB > ON",
] as const;

// Identifiants par défaut de l'interface web.
export const IDENTIFIANTS_WEB_PANASONIC = {
  identifiant: "admin",
  motDePasse: "adminpass",
} as const;

// Gabarit à coller tel quel dans Provisioning Server : {MODEL} et {MAC} sont des variables
// interprétées par le téléphone, ne pas les remplacer.
export const URL_AUTOPROVISION_PANASONIC = "https://titan.eqinoxe.com/sip-ps/{MODEL}-{MAC}.cfg";

export const AUTOPROVISION_PANASONIC = [
  "Interface web > Maintenance",
  "Renseigner Provisioning Server, Authentification ID et Authentification password",
] as const;
