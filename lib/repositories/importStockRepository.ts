import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export interface ArticleStockRow {
  type: string; // nom de l'onglet
  numeroSerie: string;
  dateReception: Date | null;
  etatAppareil: string | null;
  dateEnvoi: Date | null;
  clientFinal: string | null;
}

const S = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const nettoyer = (v: string): string | null => {
  const t = v.trim();
  return t && t !== "-" ? t : null;
};

function laDate(cell: ExcelJS.Cell): Date | null {
  const v = cell.value;
  if (v instanceof Date) return v;
  const t = S(cell.text).trim();
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

// Parse le fichier "Stock matériel" (un onglet par type de matériel). Chaque onglet a une ligne
// d'en-têtes; on repère les colonnes par leur intitulé (le SIM n'a pas les mêmes que les box).
export async function parseStockWorkbook(
  buffer: Buffer
): Promise<{ rows: ArticleStockRow[]; ignores: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const rows: ArticleStockRow[] = [];
  let ignores = 0;

  for (const ws of wb.worksheets) {
    if (ws.rowCount < 2) continue;
    const type = ws.name.trim();

    const entetes: Record<string, number> = {};
    for (let c = 1; c <= ws.columnCount; c++) {
      const nom = S(ws.getRow(1).getCell(c).text).trim().toLowerCase();
      if (nom) entetes[nom] = c;
    }
    const col = (...noms: string[]) => {
      for (const n of noms) if (entetes[n]) return entetes[n];
      return 0;
    };
    const cSerie = col("numéro série", "numero serie", "n° série");
    const cReception = col("date de reception", "date de réception");
    const cEnvoi = col("date d'envoie", "date d'envoi");
    const cClient = col("client final");
    const cEtat = col("etat de l appareil", "état de l'appareil");
    if (!cSerie) continue;

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const numeroSerie = S(row.getCell(cSerie).text).trim();
      if (!numeroSerie) {
        ignores++;
        continue;
      }
      rows.push({
        type,
        numeroSerie,
        dateReception: cReception ? laDate(row.getCell(cReception)) : null,
        etatAppareil: cEtat ? nettoyer(S(row.getCell(cEtat).text)) : null,
        dateEnvoi: cEnvoi ? laDate(row.getCell(cEnvoi)) : null,
        clientFinal: cClient ? nettoyer(S(row.getCell(cClient).text)) : null,
      });
    }
  }

  return { rows, ignores };
}

export interface StockPreviewRow extends ArticleStockRow {
  dejaPresent: boolean;
}

export async function previewStock(rows: ArticleStockRow[]): Promise<StockPreviewRow[]> {
  const existants = await prisma.articleStock.findMany({
    where: { archiveA: null },
    select: { numeroSerie: true },
  });
  const series = new Set(existants.map((e) => e.numeroSerie));
  return rows.map((r) => ({ ...r, dejaPresent: series.has(r.numeroSerie) }));
}

export interface ImportStockResultat {
  crees: number;
  dejaPresents: number;
  parType: Record<string, number>;
}

// Importe les articles. Dédup par n° série (un article déjà présent n'est pas recréé). Statut
// initial déduit du fichier: si une date d'envoi et un client sont présents, l'article est déjà
// ENVOYE, sinon EN_STOCK.
export async function importStock(rows: ArticleStockRow[]): Promise<ImportStockResultat> {
  const res: ImportStockResultat = { crees: 0, dejaPresents: 0, parType: {} };

  const existants = await prisma.articleStock.findMany({
    where: { archiveA: null },
    select: { numeroSerie: true },
  });
  const series = new Set(existants.map((e) => e.numeroSerie));

  for (const row of rows) {
    if (series.has(row.numeroSerie)) {
      res.dejaPresents++;
      continue;
    }
    series.add(row.numeroSerie);
    const statut = row.dateEnvoi || row.clientFinal ? "ENVOYE" : "EN_STOCK";
    await prisma.articleStock.create({
      data: {
        type: row.type,
        numeroSerie: row.numeroSerie,
        dateReception: row.dateReception,
        etatAppareil: row.etatAppareil,
        dateEnvoi: row.dateEnvoi,
        clientFinalTexte: row.clientFinal,
        statut,
      },
    });
    res.crees++;
    res.parType[row.type] = (res.parType[row.type] ?? 0) + 1;
  }
  return res;
}
