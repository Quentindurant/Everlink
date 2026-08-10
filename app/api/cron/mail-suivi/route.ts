import { NextRequest, NextResponse } from "next/server";
import { runMailSuivi } from "@/lib/mail/suiviMailjet";

export const dynamic = "force-dynamic";

// Relève l'état de délivrabilité des mails envoyés via Mailjet (livré/ouvert/bounce).
// Protégé par le même secret que les autres crons — fréquence conseillée : 2h.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMailSuivi();
    return NextResponse.json(result, { status: result.succes ? 200 : 207 });
  } catch (err) {
    console.error("Unhandled error during CRON mail suivi:", err);
    return NextResponse.json({ error: "Mail suivi failed unexpectedly" }, { status: 500 });
  }
}
