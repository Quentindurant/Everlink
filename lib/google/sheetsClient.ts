import { google } from "googleapis";

export interface SheetTabWrite {
  tabName: string;
  banner: string;
  headers: string[];
  rows: string[][];
}

function columnLetter(n: number): string {
  let s = "";
  let remaining = n;
  while (remaining > 0) {
    const rem = (remaining - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return s;
}

export async function writeSheetTabs(
  spreadsheetId: string,
  tabs: SheetTabWrite[]
): Promise<void> {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentialsJson),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  for (const tab of tabs) {
    const values = [[tab.banner], tab.headers, ...tab.rows];
    const width = Math.max(tab.headers.length, 1);
    const range = `${tab.tabName}!A1:${columnLetter(width)}${values.length}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}
