import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { normaliserNumero } from "@/lib/domain/normalisation";

export interface NumeroV4Row {
  // Numéro en digits (0134087230), conforme à la préférence d'affichage.
  numeroBrut: string;
  numeroNormalise: string;
  rio: string | null;
  statut: string | null;
  service: string | null;
}

const S = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const nettoyer = (v: string): string | null => {
  const t = v.trim();
  return t && t !== "-" ? t : null;
};

// Parse l'export Sewan v4 "Numéros internes" (.xlsx). Colonnes repérées par en-tête:
// Identifiant, RIO, Service, Statut. Lignes sans numéro exploitable ignorées.
export async function parseNumerosV4Workbook(
  buffer: Buffer
): Promise<{ rows: NumeroV4Row[]; ignores: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], ignores: 0 };

  const txt = (c: number, row: ExcelJS.Row) => S(row.getCell(c).text);

  // Ligne d'en-têtes = celle qui contient "Identifiant".
  let headerRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const vals = [];
    for (let c = 1; c <= ws.columnCount; c++) vals.push(txt(c, ws.getRow(r)).toLowerCase());
    if (vals.includes("identifiant")) {
      headerRow = r;
      break;
    }
  }

  const entetes: Record<string, number> = {};
  for (let c = 1; c <= ws.columnCount; c++) {
    entetes[txt(c, ws.getRow(headerRow)).trim().toLowerCase()] = c;
  }
  const col = (nom: string) => entetes[nom] ?? 0;
  const colId = col("identifiant");
  const colRio = col("rio");
  const colStatut = col("statut");
  const colService = col("service");

  const rows: NumeroV4Row[] = [];
  let ignores = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const numeroNormalise = normaliserNumero(txt(colId, row));
    if (!/^\d{6,}$/.test(numeroNormalise)) {
      if (txt(colId, row).trim()) ignores++;
      continue;
    }
    rows.push({
      numeroBrut: numeroNormalise,
      numeroNormalise,
      rio: colRio ? nettoyer(txt(colRio, row)) : null,
      statut: colStatut ? nettoyer(txt(colStatut, row)) : null,
      service: colService ? nettoyer(txt(colService, row)) : null,
    });
  }
  return { rows, ignores };
}

export interface NumeroV4Preview extends NumeroV4Row {
  dejaPresent: boolean;
  // true si le numéro existe déjà mais sans RIO: l'import va l'enrichir.
  enrichitRio: boolean;
}

export async function previewNumerosV4(
  clientId: string,
  rows: NumeroV4Row[]
): Promise<NumeroV4Preview[]> {
  const existants = await prisma.numero.findMany({
    where: { clientId, archiveA: null },
    select: { numeroNormalise: true, rio: true },
  });
  const parNum = new Map(existants.map((e) => [e.numeroNormalise, e.rio]));
  return rows.map((r) => {
    const present = parNum.has(r.numeroNormalise);
    return {
      ...r,
      dejaPresent: present,
      enrichitRio: present && !parNum.get(r.numeroNormalise) && !!r.rio,
    };
  });
}

export interface ImportNumerosResultat {
  crees: number;
  enrichis: number;
  dejaPresents: number;
}

// Importe les numéros v4. Numéro déjà présent: on enrichit son RIO s'il en manque un, sinon on
// le laisse. Numéro absent: créé en orphelin (sans utilisateur), comme un numéro non attribué.
export async function importNumerosV4(
  clientId: string,
  rows: NumeroV4Row[]
): Promise<ImportNumerosResultat> {
  const res: ImportNumerosResultat = { crees: 0, enrichis: 0, dejaPresents: 0 };

  const existants = await prisma.numero.findMany({
    where: { clientId, archiveA: null },
    select: { id: true, numeroNormalise: true, rio: true },
  });
  const parNum = new Map(existants.map((e) => [e.numeroNormalise, e]));

  for (const row of rows) {
    const existant = parNum.get(row.numeroNormalise);
    if (existant) {
      if (!existant.rio && row.rio) {
        await prisma.numero.update({ where: { id: existant.id }, data: { rio: row.rio } });
        res.enrichis++;
      } else {
        res.dejaPresents++;
      }
      continue;
    }
    const cree = await prisma.numero.create({
      data: {
        clientId,
        utilisateurId: null,
        numeroBrut: row.numeroBrut,
        numeroNormalise: row.numeroNormalise,
        numerosCourts: [],
        rio: row.rio,
        commentaire: row.service ? `Sewan v4 · ${row.service}` : null,
      },
    });
    parNum.set(row.numeroNormalise, { id: cree.id, numeroNormalise: row.numeroNormalise, rio: row.rio });
    res.crees++;
  }
  return res;
}
