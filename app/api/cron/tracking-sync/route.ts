import { NextRequest, NextResponse } from "next/server";
import { runTrackingSync } from "@/lib/tracking/runTrackingSync";

export const dynamic = "force-dynamic";

// Rafraîchit l'état des colis en cours (La Poste/Chronopost). Protégé par le même secret que
// les autres crons, appelé par un scheduler externe (crontab VPS) — fréquence conseillée: 2h.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTrackingSync();
    return NextResponse.json(result, { status: result.succes ? 200 : 207 });
  } catch (err) {
    console.error("Unhandled error during CRON tracking sync:", err);
    return NextResponse.json({ error: "Tracking sync failed unexpectedly" }, { status: 500 });
  }
}
