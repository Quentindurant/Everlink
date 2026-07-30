import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { writeMacXlsx, writeSdaXlsx } from "./xlsxWriter";

const SDA_ROWS = [
  ["Client (raison sociale)", "Numéro à porter"],
  ["AART ELECTRONICS", "01 80 87 33 45"],
  ["AVA", "0241921730"],
];

const MAC_ROWS = [
  ["Client (raison sociale)", "Adresse MAC équipement"],
  ["AART ELECTRONICS", "80:5E:0C:53:D6:70"],
  ["AART ELECTRONICS", "030AD2466B"],
];

async function relire(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Feuil1");
  if (!ws) throw new Error("Feuille Feuil1 absente");
  return ws;
}

describe("writeSdaXlsx", () => {
  test("feuille Feuil1, largeurs 48/15, filtre auto, numéros en texte, en-têtes non gras", async () => {
    const buffer = await writeSdaXlsx(SDA_ROWS);
    const ws = await relire(buffer);

    expect(ws.name).toBe("Feuil1");
    expect(Math.round(ws.getColumn(1).width ?? 0)).toBe(48);
    expect(Math.round(ws.getColumn(2).width ?? 0)).toBe(15);
    expect(ws.autoFilter).toBeTruthy();
    // Zéro initial conservé: la valeur relue est la chaîne d'origine, pas un nombre.
    expect(ws.getCell("B3").value).toBe("0241921730");
    expect(ws.getCell("B2").numFmt).toBe("@");
    expect(ws.getCell("A1").font?.bold ?? false).toBe(false);
    expect(ws.getCell("A2").value).toBe("AART ELECTRONICS");
    expect(ws.rowCount).toBe(3);
  });
});

describe("writeMacXlsx", () => {
  test("feuille Feuil1, largeurs 48/22.71, pas de filtre, MAC intactes", async () => {
    const buffer = await writeMacXlsx(MAC_ROWS);
    const ws = await relire(buffer);

    expect(ws.name).toBe("Feuil1");
    expect(Math.round(ws.getColumn(1).width ?? 0)).toBe(48);
    expect(Math.abs((ws.getColumn(2).width ?? 0) - 22.71)).toBeLessThan(0.05);
    expect(ws.autoFilter ?? null).toBeNull();
    // Casse et séparateurs jamais uniformisés (SPEC §6.3).
    expect(ws.getCell("B2").value).toBe("80:5E:0C:53:D6:70");
    expect(ws.getCell("B3").value).toBe("030AD2466B");
  });
});
