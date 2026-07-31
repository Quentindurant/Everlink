import nodemailer from "nodemailer";

// Envoi SMTP. Config lue dans l'environnement pour ne jamais committer d'identifiants:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("1" pour TLS implicite), SMTP_USER, SMTP_PASS, SMTP_FROM
// Si la config est absente, on renvoie une erreur explicite plutôt que de crasher: la feature
// (templates, prévisualisation, trace) reste utilisable tant que le SMTP n'est pas branché.
export async function envoyerMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
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
    await transport.sendMail({ from: SMTP_FROM, to, subject, text });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec de l'envoi SMTP." };
  }
}
