import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeMacXlsxDeuxOnglets, writeSdaXlsx } from "@/lib/domain/exports/xlsxWriter";
import {
  buildExport,
  nomFichierExport,
  parseScope,
} from "@/lib/exports/exportService";

// Le matcher du proxy exclut /api/ : chaque route d'export vérifie donc la session
// elle-même. Sans session, 401 — jamais de fichier.
export async function handleExportDownload(
  type: "sda" | "mac",
  request: Request
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const url = new URL(request.url);
  const scope = parseScope(url.searchParams);
  const [{ entetes, rows, reseauRows }, nomFichier] = await Promise.all([
    buildExport(type, scope),
    nomFichierExport(type, scope),
  ]);

  const buffer =
    type === "sda"
      ? await writeSdaXlsx([entetes, ...rows])
      : await writeMacXlsxDeuxOnglets([entetes, ...rows], [entetes, ...reseauRows]);

  // Trace d'audit rejouable (SPEC §3.4): portée, volume et contenu exact du fichier remis.
  await prisma.exportBatch.create({
    data: {
      type: type === "sda" ? "SDA" : "MAC",
      lotId: scope.lotId ?? null,
      filtres: JSON.parse(JSON.stringify(scope)),
      nomFichier,
      nbLignes: rows.length,
      contenu: rows,
      auteurId: session.user.id ?? null,
    },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
