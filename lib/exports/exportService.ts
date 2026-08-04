import { prisma } from "@/lib/prisma";
import { buildSdaRows, SDA_HEADERS } from "@/lib/domain/exports/sda";
import { buildMacPreviewRows, buildMacRows, MAC_HEADERS } from "@/lib/domain/exports/mac";
import {
  fetchMacData,
  fetchMacEcarts,
  fetchSdaData,
  fetchSdaEcarts,
  type ExportScope,
} from "@/lib/repositories/syncRepository";

export function parseScope(searchParams: URLSearchParams | Record<string, string | undefined>): ExportScope {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? searchParams.get(key) ?? undefined : searchParams[key];
  return {
    lotId: get("lot") || undefined,
    clientIds: get("client") ? [get("client") as string] : undefined,
    exclureBascules: get("exclureBascules") === "1",
  };
}

// Nommage des fichiers (SPEC §6.4): espace avant le tiret pour le SDA, pas pour le MAC,
// comme dans les templates fournis.
export async function nomFichierExport(type: "sda" | "mac", scope: ExportScope): Promise<string> {
  let reference = "EXPORT";
  if (scope.lotId) {
    const lot = await prisma.lot.findUnique({ where: { id: scope.lotId } });
    reference = lot?.reference ?? lot?.nom ?? reference;
  }
  return type === "sda" ? `Import_SDA_-_${reference}.xlsx` : `Import_MAC-_${reference}.xlsx`;
}

export async function buildExport(type: "sda" | "mac", scope: ExportScope) {
  if (type === "sda") {
    const [data, ecarts] = await Promise.all([fetchSdaData(scope), fetchSdaEcarts(scope)]);
    const rows = buildSdaRows(data);
    return { entetes: SDA_HEADERS, rows, ecarts, previewEntetes: SDA_HEADERS, previewRows: rows };
  }
  const [data, ecarts] = await Promise.all([fetchMacData(scope), fetchMacEcarts(scope)]);
  // La préview écran porte le modèle en 3e colonne; le fichier xlsx reste à 2 colonnes
  // (template UNYC strict).
  return {
    entetes: MAC_HEADERS,
    rows: buildMacRows(data),
    ecarts,
    previewEntetes: [...MAC_HEADERS, "Équipement"],
    previewRows: buildMacPreviewRows(data),
  };
}

export function repartitionParClient(rows: string[][]): { raisonSociale: string; nb: number }[] {
  const compte = new Map<string, number>();
  for (const [raisonSociale] of rows) {
    compte.set(raisonSociale, (compte.get(raisonSociale) ?? 0) + 1);
  }
  return Array.from(compte.entries()).map(([raisonSociale, nb]) => ({ raisonSociale, nb }));
}
