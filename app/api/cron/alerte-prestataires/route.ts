import { NextRequest, NextResponse } from "next/server";
import { runAlertePrestataires } from "@/lib/alertes/prestataires";

export const dynamic = "force-dynamic";

// Alerte le chef de projet quand un prestataire externe reste sans réponse à l'approche de
// l'intervention (J-3). Protégé par le même secret que les autres crons — fréquence
// conseillée : deux fois par jour, l'envoi est idempotent sur 20 h.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runAlertePrestataires();
    return NextResponse.json(result, { status: result.succes ? 200 : 207 });
  } catch (err) {
    console.error("Unhandled error during CRON alerte prestataires:", err);
    return NextResponse.json({ error: "Alerte prestataires failed" }, { status: 500 });
  }
}
