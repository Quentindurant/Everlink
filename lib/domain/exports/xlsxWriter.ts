import ExcelJS from "exceljs";

// Formats stricts des templates UNYC (SPEC §6.2/6.3): feuille "Feuil1", en-têtes non gras,
// largeurs exactes, numéros en format texte "@" (zéro initial conservé), filtre auto
// uniquement sur le SDA. Toute divergence casse la comparaison aux golden files.

async function writeWorkbook(
  rows: string[][],
  options: { largeurB: number; autoFilter: boolean; colonneBTexte: boolean }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Feuil1");

  ws.getColumn(1).width = 48;
  ws.getColumn(2).width = options.largeurB;

  for (const row of rows) {
    ws.addRow(row);
  }

  if (options.colonneBTexte) {
    ws.getColumn(2).eachCell((cell) => {
      cell.numFmt = "@";
    });
  }

  if (options.autoFilter) {
    ws.autoFilter = "A1:B1";
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function writeSdaXlsx(rows: string[][]): Promise<Buffer> {
  return writeWorkbook(rows, { largeurB: 15, autoFilter: true, colonneBTexte: true });
}

export async function writeMacXlsx(rows: string[][]): Promise<Buffer> {
  return writeWorkbook(rows, { largeurB: 22.71, autoFilter: false, colonneBTexte: false });
}

// Export MAC à deux onglets: "Feuil1" (téléphonie, format UNYC) + "Réseau" (switch, routeur,
// OneAccess, 4G). Le second onglet n'est ajouté que s'il porte des lignes (au-delà de l'en-tête).
export async function writeMacXlsxDeuxOnglets(
  telephonie: string[][],
  reseau: string[][]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const remplir = (nom: string, rows: string[][]) => {
    const ws = wb.addWorksheet(nom);
    ws.getColumn(1).width = 48;
    ws.getColumn(2).width = 22.71;
    ws.getColumn(3).width = 28;
    for (const row of rows) ws.addRow(row);
  };

  remplir("Feuil1", telephonie);
  if (reseau.length > 1) remplir("Réseau", reseau);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
