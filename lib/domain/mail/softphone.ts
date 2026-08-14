// Clients équipés de softphones (DOKO chez Sewan, Speek chez UNYC) : l'application se
// réinstalle sur les postes de travail du client. Plusieurs interventions ont été bloquées
// sur place parce que l'informaticien du client interdit l'installation de logiciels — d'où
// une demande de préparation dès la prévenance, et les guides joints à la confirmation.

// Paragraphe ajouté au mail de prévenance quand des utilisateurs ont un softphone.
export function blocPreparationSpeek(nbUtilisateurs: number): string {
  const postes =
    nbUtilisateurs > 1
      ? `${nbUtilisateurs} de vos collaborateurs utilisent`
      : "L'un de vos collaborateurs utilise";
  return [
    "Action à prévoir de votre côté — application de téléphonie sur ordinateur",
    "",
    `${postes} aujourd'hui l'application DOKO sur leur poste de travail. Elle sera remplacée par l'application Speek.`,
    "",
    "Nous vous remercions de faire installer Speek sur les postes concernés AVANT notre intervention, et de nous confirmer que l'installation a bien pu être réalisée. Si l'installation de logiciels est soumise à l'accord de votre service informatique ou de votre prestataire, merci d'anticiper cette demande auprès d'eux dès maintenant.",
    "",
    "Sans cette confirmation, nous ne pourrons pas figer la date d'intervention : une application non installable le jour J bloque la migration des postes concernés.",
  ].join("\n");
}

// Nom de dossier des guides joints à la confirmation (sous public/guides/).
export const DOSSIER_GUIDES_SPEEK = "speek";

// Phrase annonçant les guides joints, ajoutée au mail de confirmation.
export function blocGuidesSpeek(nbGuides: number): string {
  if (nbGuides === 0) return "";
  return [
    "Application Speek",
    "",
    `Vous trouverez ${nbGuides > 1 ? "en pièces jointes les guides d'utilisation" : "en pièce jointe le guide d'utilisation"} de l'application Speek, à transmettre aux collaborateurs concernés.`,
    "",
    "Nous vous rappelons que l'application doit être installée sur leurs postes avant l'intervention.",
  ].join("\n");
}
