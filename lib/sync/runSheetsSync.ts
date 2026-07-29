import { prisma } from "@/lib/prisma";
import { writeSheetTabs, type SheetTabWrite } from "@/lib/google/sheetsClient";
import {
  fetchProvisionningData,
  fetchClientsData,
  fetchTelephoneData,
  fetchSdaData,
  fetchMacData,
} from "@/lib/repositories/syncRepository";
import { buildProvisionningRows, PROVISIONNING_HEADERS } from "@/lib/domain/sync/provisionning";
import { buildClientsRows, CLIENTS_HEADERS } from "@/lib/domain/sync/clients";
import { buildTelephoneRows, buildTelephoneHeaders } from "@/lib/domain/sync/telephone";
import { buildSdaRows, SDA_HEADERS } from "@/lib/domain/exports/sda";
import { buildMacRows, MAC_HEADERS } from "@/lib/domain/exports/mac";

const BANNER = "⚠ Fichier généré automatiquement par Everlink — toute modification sera écrasée";

export interface SheetSyncRunResult {
  succes: boolean;
  ongletsEcrits: Record<string, number>;
  ongletsIgnores: Record<string, number>;
  erreurs: Record<string, string>;
}

function buildTab(tabName: string, headers: string[], rows: string[][]): SheetTabWrite {
  return { tabName, banner: BANNER, headers, rows };
}

export async function runSheetsSync(
  declencheur: "MANUEL" | "CRON" | "CLI",
  auteurId?: string
): Promise<SheetSyncRunResult> {
  const ongletsEcrits: Record<string, number> = {};
  const ongletsIgnores: Record<string, number> = {};
  const erreurs: Record<string, string> = {};
  const tabs: SheetTabWrite[] = [];

  const builders: Array<{ name: string; build: () => Promise<SheetTabWrite> }> = [
    {
      name: "Provisionning",
      build: async () => {
        const { numeros, equipementsOrphelins } = await fetchProvisionningData();
        return buildTab(
          "Provisionning",
          PROVISIONNING_HEADERS,
          buildProvisionningRows(numeros, equipementsOrphelins)
        );
      },
    },
    {
      name: "Clients",
      build: async () => buildTab("Clients", CLIENTS_HEADERS, buildClientsRows(await fetchClientsData())),
    },
    {
      name: "Téléphone",
      build: async () => {
        const { utilisateurs, etapeLibelles } = await fetchTelephoneData();
        return buildTab(
          "Téléphone",
          buildTelephoneHeaders(etapeLibelles),
          buildTelephoneRows(utilisateurs, etapeLibelles)
        );
      },
    },
    {
      name: "Import SDA",
      build: async () => buildTab("Import SDA", SDA_HEADERS, buildSdaRows(await fetchSdaData())),
    },
    {
      name: "Import MAC",
      build: async () => buildTab("Import MAC", MAC_HEADERS, buildMacRows(await fetchMacData())),
    },
  ];

  // Root-cause guard for the production incident: an empty-database sync run must never
  // silently replace a Sheet tab that still holds real data with zero rows. Skip writing
  // (neither clear nor update) any tab with no data rows, unless explicitly opted into via
  // SHEETS_SYNC_ALLOW_EMPTY=1. Skips are recorded in ongletsIgnores so they're visible in
  // the audit log rather than indistinguishable from a normal, successful, empty write.
  const allowEmpty = process.env.SHEETS_SYNC_ALLOW_EMPTY === "1";

  for (const { name, build } of builders) {
    try {
      const tab = await build();
      if (tab.rows.length === 0 && !allowEmpty) {
        ongletsIgnores[name] = 0;
        continue;
      }
      tabs.push(tab);
      ongletsEcrits[name] = tab.rows.length;
    } catch (err) {
      erreurs[name] = err instanceof Error ? err.message : String(err);
    }
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    erreurs["_global"] = "GOOGLE_SHEET_ID is not set";
  } else if (tabs.length > 0) {
    try {
      const result = await writeSheetTabs(spreadsheetId, tabs);
      for (const tabName of Object.keys(ongletsEcrits)) {
        if (!result.written.includes(tabName)) {
          delete ongletsEcrits[tabName];
        }
      }
      Object.assign(erreurs, result.failed);
    } catch (err) {
      erreurs["_global"] = err instanceof Error ? err.message : String(err);
      for (const key of Object.keys(ongletsEcrits)) delete ongletsEcrits[key];
    }
  }

  const succes = Object.keys(erreurs).length === 0;

  // The audit-log write happens after the (possibly destructive) Sheet write, so it must
  // never be allowed to throw: a failure here would otherwise mask that a sync just ran,
  // leaving no record at all that data may have been touched. Log and move on instead.
  //
  // ongletsIgnores isn't its own Prisma column (no migration for it) — it's folded into the
  // existing `erreurs` Json? column under a reserved key, the same convention already used
  // for the "_global" error key, so a skip stays visible in the audit log without a schema
  // change.
  const persistedErreurs: Record<string, string | Record<string, number>> = { ...erreurs };
  if (Object.keys(ongletsIgnores).length > 0) {
    persistedErreurs["_ongletsIgnores"] = ongletsIgnores;
  }

  try {
    await prisma.sheetSyncRun.create({
      data: {
        declencheur,
        ongletsEcrits,
        erreurs: Object.keys(persistedErreurs).length > 0 ? persistedErreurs : undefined,
        succes,
        auteurId: auteurId ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to persist SheetSyncRun audit record:", err);
  }

  return { succes, ongletsEcrits, ongletsIgnores, erreurs };
}
