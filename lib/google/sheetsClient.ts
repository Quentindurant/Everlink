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

// Google's A1 notation requires single-quoting a sheet/tab name whenever it contains
// spaces or non-ASCII characters ("Import SDA", "Import MAC", "Téléphone" all qualify),
// even though the unquoted form happened to work in practice.
function quotedRange(tabName: string): string {
  return `'${tabName.replace(/'/g, "''")}'`;
}

export interface SheetWriteResult {
  written: string[];
  failed: Record<string, string>;
}

export async function writeSheetTabs(
  spreadsheetId: string,
  tabs: SheetTabWrite[]
): Promise<SheetWriteResult> {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    // A raw SyntaxError from V8 can embed a window of the offending input in its message,
    // which for this env var may include a fragment of a private key. Never let that
    // propagate into logs, the audit table, or an API response.
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const written: string[] = [];
  const failed: Record<string, string> = {};

  for (const tab of tabs) {
    let clearedOk = false;
    try {
      // Clear the whole tab first — a values.update call only touches cells within
      // its own range, so without this, any pre-existing content past our new
      // content's extent (a wider sheet, more rows, or simply a tab that already
      // had real data before this app ever wrote to it) survives untouched and
      // ends up mixed in under our banner/headers.
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: quotedRange(tab.tabName),
      });
      clearedOk = true;

      const values = [[tab.banner], tab.headers, ...tab.rows];
      const width = Math.max(tab.headers.length, 1);
      const range = `${quotedRange(tab.tabName)}!A1:${columnLetter(width)}${values.length}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
      written.push(tab.tabName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // clear and update are two separate API calls, not a transaction. If clear succeeded
      // but update threw, the tab is now empty — say so explicitly rather than leaving an
      // ambiguous error that could mean either "nothing happened" or "data was destroyed".
      failed[tab.tabName] = clearedOk
        ? `cleared but write failed — tab is now EMPTY: ${message}`
        : `clear failed, tab unchanged: ${message}`;
    }
  }

  return { written, failed };
}
