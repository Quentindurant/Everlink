import nodemailer from "nodemailer";
import {
  corpsEnHtml,
  pieceJointeLogo,
  SIGNATURE_TEXTE,
  signatureHtml,
} from "@/lib/mail/signature";

// Envoi SMTP. Config lue dans l'environnement pour ne jamais committer d'identifiants:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("1" pour TLS implicite), SMTP_USER, SMTP_PASS, SMTP_FROM
// Si la config est absente, on renvoie une erreur explicite plutôt que de crasher: la feature
// (templates, prévisualisation, trace) reste utilisable tant que le SMTP n'est pas branché.
export async function envoyerMail({
  to,
  subject,
  text,
  customId,
  cc,
}: {
  to: string;
  subject: string;
  text: string;
  // Identifiant de corrélation Mailjet (X-MJ-CustomID) : permet au cron mail-suivi de
  // retrouver l'état de délivrabilité du message via l'API REST. Ignoré hors Mailjet.
  customId?: string;
  // Adresse mise en copie (paramètre « copieMail » de l'app).
  cc?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    return {
      success: false,
      error: "SMTP non configuré (SMTP_HOST, SMTP_PORT, SMTP_FROM manquants).",
    };
  }
  if (!to.trim()) return { success: false, error: "Destinataire manquant." };

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === "1",
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    // Version HTML (corps + signature EverLink avec logo inline) ; le texte brut reste en
    // fallback pour les clients mail qui n'affichent pas le HTML.
    const logo = pieceJointeLogo();
    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text: `${text}\n\n${SIGNATURE_TEXTE}`,
      html: corpsEnHtml(text) + signatureHtml(),
      ...(logo ? { attachments: [logo] } : {}),
      ...(cc?.trim() ? { cc: cc.trim() } : {}),
      ...(customId ? { headers: { "X-MJ-CustomID": customId } } : {}),
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'envoi SMTP." };
  }
}
