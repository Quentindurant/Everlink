import { prisma } from "@/lib/prisma";

// Relevé de délivrabilité Mailjet : pour chaque envoi récent tagué d'un CustomID, interroge
// l'API REST (mêmes clés que le SMTP) et mémorise l'état livré/ouvert/bounce sur MailEnvoi.
// Sans config Mailjet, ne fait rien : la feature reste inerte hors production.

const FENETRE_JOURS = 7;

export async function runMailSuivi(): Promise<{
  succes: boolean;
  releves: number;
  erreurs: number;
}> {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST?.includes("mailjet") || !SMTP_USER || !SMTP_PASS) {
    return { succes: true, releves: 0, erreurs: 0 };
  }

  const depuis = new Date(Date.now() - FENETRE_JOURS * 86400000);
  const envois = await prisma.mailEnvoi.findMany({
    where: { succes: true, mailjetCustomId: { not: null }, creeLe: { gte: depuis } },
    select: { id: true, mailjetCustomId: true, suiviStatut: true },
  });

  const auth = Buffer.from(`${SMTP_USER}:${SMTP_PASS}`).toString("base64");
  let releves = 0;
  let erreurs = 0;
  for (const e of envois) {
    try {
      const r = await fetch(
        `https://api.mailjet.com/v3/REST/message?CustomID=${encodeURIComponent(e.mailjetCustomId!)}`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      if (!r.ok) {
        erreurs++;
        continue;
      }
      const corps = (await r.json()) as { Data?: { Status?: string }[] };
      const statut = corps.Data?.[0]?.Status?.toLowerCase() ?? null;
      if (statut && statut !== e.suiviStatut) {
        await prisma.mailEnvoi.update({
          where: { id: e.id },
          data: { suiviStatut: statut, suiviMajLe: new Date() },
        });
        releves++;
      }
    } catch {
      erreurs++;
    }
  }
  return { succes: erreurs === 0, releves, erreurs };
}
