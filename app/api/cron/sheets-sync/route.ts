import { NextRequest, NextResponse } from "next/server";
import { runSheetsSync } from "@/lib/sync/runSheetsSync";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSheetsSync("CRON");
  return NextResponse.json(result, { status: result.succes ? 200 : 207 });
}
