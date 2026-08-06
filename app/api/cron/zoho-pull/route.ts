import { NextRequest, NextResponse } from "next/server";
import { runZohoPull } from "@/lib/zoho/syncDepuisSheet";

export const dynamic = "force-dynamic";

// Synchronise le Zoho Sheet vers l'app (statut, date, heure, technicien des dossiers
// rapprochés). Même protection que les autres crons ; fréquence conseillée: 2h.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runZohoPull();
    return NextResponse.json(result, { status: result.succes ? 200 : 207 });
  } catch (err) {
    console.error("Unhandled error during CRON zoho pull:", err);
    return NextResponse.json({ error: "Zoho pull failed unexpectedly" }, { status: 500 });
  }
}
