// Statuts message Mailjet → libellé et couleur affichés dans l'onglet Mails.
// Module pur (importable côté client), le relevé lui-même vit dans lib/mail/suiviMailjet.
export const SUIVI_MAIL: Record<string, { libelle: string; niveau: "ok" | "info" | "erreur" }> = {
  queued: { libelle: "En file", niveau: "info" },
  sent: { libelle: "Livré", niveau: "ok" },
  opened: { libelle: "Ouvert", niveau: "ok" },
  clicked: { libelle: "Ouvert (lien cliqué)", niveau: "ok" },
  deferred: { libelle: "Différé", niveau: "info" },
  softbounced: { libelle: "Rejeté (temporaire)", niveau: "erreur" },
  bounce: { libelle: "Rejeté", niveau: "erreur" },
  hardbounced: { libelle: "Rejeté (définitif)", niveau: "erreur" },
  blocked: { libelle: "Bloqué", niveau: "erreur" },
  spam: { libelle: "Signalé spam", niveau: "erreur" },
  unsub: { libelle: "Désabonné", niveau: "erreur" },
};
