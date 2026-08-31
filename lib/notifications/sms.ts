// Envoi de SMS, utilisé pour alerter un chef de projet sur son téléphone professionnel.
//
// Canal enfichable : tant que MAILJET_SMS_TOKEN n'est pas renseigné, `envoyerSms` renvoie
// simplement « non configuré » sans rien casser — l'alerte part alors par notification et
// par mail. L'offre e-mail gratuite de Mailjet n'inclut PAS le SMS : il est facturé au
// message et son jeton se génère à part, dans la section SMS du compte.
//
// Variables d'environnement :
//   MAILJET_SMS_TOKEN   jeton Bearer de l'API SMS (distinct des clés API e-mail)
//   MAILJET_SMS_FROM    nom de l'expéditeur affiché, 3 à 11 caractères (ex "EverLink")

const API_SMS = "https://api.mailjet.com/v4/sms-send";

export interface ResultatSms {
  success: boolean;
  error?: string;
  /** Vrai quand aucun canal SMS n'est configuré : ce n'est pas une panne. */
  nonConfigure?: boolean;
}

// Format international attendu par Mailjet : "0612345678" → "+33612345678".
export function normaliserNumeroSms(numero: string, indicatif = "+33"): string | null {
  const chiffres = numero.replace(/[^\d+]/g, "");
  if (chiffres.startsWith("+")) return chiffres.length >= 11 ? chiffres : null;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  if (chiffres.length === 10 && chiffres.startsWith("0")) return `${indicatif}${chiffres.slice(1)}`;
  return null;
}

export async function envoyerSms(numero: string, texte: string): Promise<ResultatSms> {
  const token = process.env.MAILJET_SMS_TOKEN;
  const from = process.env.MAILJET_SMS_FROM || "EverLink";
  if (!token) return { success: false, nonConfigure: true, error: "SMS non configuré." };

  const to = normaliserNumeroSms(numero);
  if (!to) return { success: false, error: `Numéro inexploitable : ${numero}` };

  try {
    const res = await fetch(API_SMS, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ From: from, To: to, Text: texte }),
    });
    if (!res.ok) {
      const corps = await res.text();
      return { success: false, error: `Mailjet SMS ${res.status} : ${corps.slice(0, 120)}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'envoi SMS." };
  }
}
