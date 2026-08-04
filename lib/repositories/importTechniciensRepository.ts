import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { extraireDepartements } from "@/lib/domain/technicien/departements";

export interface TechnicienImportRow {
  nom: string;
  departements: string[];
  prestataireNom: string | null;
  telephone: string | null;
  email: string | null;
}

// Parse le classeur techniciens. Onglet "TECHNICIENS VALIDES" par défaut (colonnes: Identité,
// Départements, Raison sociale, Numéro, Mail). La ligne d'en-tête est celle dont la 1re cellule
// vaut "Identité du technicien".
export async function parseTechniciensWorkbook(buffer: Buffer): Promise<TechnicienImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws =
    wb.getWorksheet("TECHNICIENS VALIDES") ?? wb.getWorksheet("TECHNICIENS 26") ?? wb.worksheets[0];
  if (!ws) return [];

  // exceljs renvoie parfois autre chose qu'une string pour .text (formule, rich text, nombre).
  const txt = (c: number, row: ExcelJS.Row): string => {
    const v = row.getCell(c).text;
    return typeof v === "string" ? v : v == null ? "" : String(v);
  };

  // Localise la ligne d'en-têtes.
  let headerRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    if (txt(1, ws.getRow(r)).trim().toLowerCase().startsWith("identité")) {
      headerRow = r;
      break;
    }
  }

  const rows: TechnicienImportRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nom = txt(1, row).replace(/\s+/g, " ").trim();
    if (!nom || nom === "/") continue;
    rows.push({
      nom,
      departements: extraireDepartements(txt(2, row)),
      prestataireNom: txt(3, row).trim() || null,
      telephone: txt(4, row).trim() || null,
      email: txt(5, row).trim() || null,
    });
  }
  return rows;
}

export interface ImportTechResultat {
  crees: number;
  doublons: number;
  prestatairesCrees: string[];
}

export async function importerTechniciens(
  rows: TechnicienImportRow[]
): Promise<ImportTechResultat> {
  const res: ImportTechResultat = { crees: 0, doublons: 0, prestatairesCrees: [] };

  // Cache des prestataires par nom normalisé.
  const prestataires = await prisma.prestataire.findMany();
  const prestParNom = new Map(prestataires.map((p) => [p.nom.trim().toUpperCase(), p.id]));
  // Techniciens déjà présents (dédoublonnage sur le nom normalisé).
  const existants = await prisma.technicien.findMany({ select: { nom: true } });
  const nomsExistants = new Set(existants.map((t) => t.nom.trim().toUpperCase()));

  for (const row of rows) {
    if (nomsExistants.has(row.nom.toUpperCase())) {
      res.doublons++;
      continue;
    }
    nomsExistants.add(row.nom.toUpperCase());

    let prestataireId: string | null = null;
    if (row.prestataireNom) {
      const cle = row.prestataireNom.toUpperCase();
      prestataireId = prestParNom.get(cle) ?? null;
      if (!prestataireId) {
        const cree = await prisma.prestataire.create({ data: { nom: row.prestataireNom } });
        prestParNom.set(cle, cree.id);
        prestataireId = cree.id;
        res.prestatairesCrees.push(row.prestataireNom);
      }
    }

    await prisma.technicien.create({
      data: { nom: row.nom, prestataireId, departements: row.departements },
    });
    res.crees++;
  }
  return res;
}
