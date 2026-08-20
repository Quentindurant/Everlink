import { NextRequest, NextResponse } from "next/server";
import { runSuiviPull } from "@/lib/suivi/syncDepuisSuivi";

export const dynamic = "force-dynamic";

// Synchronise le tableau de suivi maison vers l'app (statut, date, heure, technicien des
// dossiers rapprochés). Même protection que les autres crons (header X-Cron-Secret) ;
// fréquence conseillée : 2h. L'ancienne URL /api/cron/zoho-pull reste servie en alias
// (même handler) pour ne pas casser la configuration cron déployée.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSuiviPull();
    return NextResponse.json(result, { status: result.succes ? 200 : 207 });
  } catch (err) {
    console.error("Unhandled error during CRON suivi pull:", err);
    return NextResponse.json({ error: "Suivi pull failed unexpectedly" }, { status: 500 });
  }
}
