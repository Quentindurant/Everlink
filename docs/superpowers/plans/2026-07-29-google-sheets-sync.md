# Google Sheets Outbound Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the outbound Google Sheets synchronization from SPEC.md §7.2 — five tabs
(Provisionning, Clients, Téléphone, Import SDA, Import MAC) overwritten from the app's database,
triggered by a cron endpoint and a CLI script, logged to a new `SheetSyncRun` table.

**Architecture:** Pure mapping functions in `lib/domain/` (DB rows → sheet row arrays, no Prisma/Google
dependency, unit-tested with `bun test`), a Prisma-backed repository layer that fetches the data each
mapper needs, a thin Google Sheets API client wrapper, and a single orchestrator function reused by
both trigger surfaces.

**Tech Stack:** `googleapis` (Sheets API v4), `google.auth.GoogleAuth` for service-account auth,
Prisma 7, `bun test` (built-in, no new dependency) for unit tests.

## Global Constraints

- Domain logic (mapping) lives in `lib/domain/`, pure, no Prisma or Google import — matches
  CLAUDE.md's convention. (CLAUDE.md)
- Data access lives in `lib/repositories/`. (CLAUDE.md)
- `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_SHEET_ID` are already set on Prisma Compute production
  — do not print their values anywhere, do not commit any credential file.
- Migrations are versioned files, committed, applied with `prisma migrate deploy` — never `db push`
  in production. (SPEC.md §1, CLAUDE.md)
- One sync run must not fail as a whole because one tab failed — matches the "never fail an import
  in block" business invariant, applied here to sync. (design doc, CLAUDE.md)
- Column order and content for Provisionning/Clients/Import SDA/Import MAC are fixed by SPEC.md
  §3.1, §3.2, §6.2, §6.3 — copied verbatim into each task below, not reinterpreted.

---

## Task 1: Prisma schema — add `SheetSyncRun`

**Files:**
- Modify: `prisma/schema.prisma` (add enum + model + back-relation on `UtilisateurApp`)
- Create: `prisma/migrations/<timestamp>_sheet_sync_run/migration.sql`

**Interfaces:**
- Produces: Prisma model `SheetSyncRun` with fields `id`, `declencheur` (`DeclencheurSync`:
  `MANUEL`/`CRON`/`CLI`), `ongletsEcrits` (Json), `erreurs` (Json, nullable), `succes` (Boolean),
  `auteurId` (String, nullable), `creeLe` (DateTime) — Task 8's orchestrator writes rows here.

- [ ] **Step 1: Add the enum and model**

Add to `prisma/schema.prisma`, after the `AuditLog` model at the end of the file:

```prisma
// ---------------------------------------------------------------- Synchronisation Sheets

enum DeclencheurSync {
  MANUEL
  CRON
  CLI
}

model SheetSyncRun {
  id            String          @id @default(cuid())
  declencheur   DeclencheurSync
  ongletsEcrits Json
  erreurs       Json?
  succes        Boolean         @default(true)

  auteur   UtilisateurApp? @relation(fields: [auteurId], references: [id])
  auteurId String?

  creeLe DateTime @default(now())

  @@index([creeLe])
}
```

Add the back-relation to `UtilisateurApp` (currently has `importRuns`, `exportBatchs`, `auditLogs`
— add a fourth line in the same style):

```prisma
  syncRuns     SheetSyncRun[]
```

- [ ] **Step 2: Validate the schema**

```bash
bunx prisma validate
```

Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 3: Generate the migration offline**

No local Postgres is available (same situation as the initial migration). Generate the diff against
the previous migration state, not `--from-empty` this time — there's already one applied migration.

```bash
bunx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma \
  --script > /tmp/sync_diff.sql
```

Expected: exits 0, `/tmp/sync_diff.sql` contains `CREATE TYPE "DeclencheurSync"` and
`CREATE TABLE "SheetSyncRun"` with a foreign key to `UtilisateurApp`. If this command errors because
`--from-migrations` needs a shadow database connection (unlike `--from-empty`, comparing against a
migrations history may require one) — paste the real error in your report rather than guessing
around it; the fallback is `--from-schema <path-to-a-checked-out-copy-of-the-previous-schema.prisma>`
instead of `--from-migrations`, using `git show <previous-commit>:prisma/schema.prisma > /tmp/prev-schema.prisma`
to get that previous version.

- [ ] **Step 4: Place it as a proper migration**

```bash
ts=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${ts}_sheet_sync_run"
mv /tmp/sync_diff.sql "prisma/migrations/${ts}_sheet_sync_run/migration.sql"
```

- [ ] **Step 5: Regenerate the client**

```bash
bunx prisma generate
```

Expected: succeeds, `SheetSyncRun` and `DeclencheurSync` now available on the generated client's
types.

- [ ] **Step 6: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add SheetSyncRun model for sync logging"
```

---

## Task 2: Google Sheets client wrapper

**Files:**
- Create: `lib/google/sheetsClient.ts`
- Modify: `package.json` (add `googleapis` dependency)

**Interfaces:**
- Produces: `writeSheetTabs(spreadsheetId: string, tabs: SheetTabWrite[]): Promise<void>` and the
  `SheetTabWrite` type — Task 8's orchestrator calls this once per sync run with all five tabs.

- [ ] **Step 1: Install the dependency**

```bash
bun add googleapis
```

- [ ] **Step 2: Write the client**

```typescript
// lib/google/sheetsClient.ts
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
```

- [ ] **Step 3: Verify it compiles**

```bash
bunx tsc --noEmit
```

Expected: no type errors. `googleapis`'s types cover `google.auth.GoogleAuth` and
`google.sheets(...).spreadsheets.values.update` — if either doesn't type-check as written, check
`node_modules/googleapis/build/src/apis/sheets/v4.ts` for the actual current method signature before
changing anything, and note the discrepancy in your report.

- [ ] **Step 4: Commit**

```bash
git add lib/google/sheetsClient.ts package.json bun.lock
git commit -m "feat: add Google Sheets API client wrapper"
```

---

## Task 3: Provisionning tab mapping

**Files:**
- Create: `lib/domain/sync/provisionning.ts`
- Test: `lib/domain/sync/provisionning.test.ts`

**Interfaces:**
- Produces: `PROVISIONNING_HEADERS: string[]`, `ProvisionningNumeroRow`,
  `ProvisionningEquipementRow` types, and
  `buildProvisionningRows(numeros: ProvisionningNumeroRow[], equipementsOrphelins: ProvisionningEquipementRow[]): string[][]`
  — Task 7's repository fetches the input rows, Task 8's orchestrator calls this and passes the
  result to `writeSheetTabs`.

Column order per SPEC.md §3.1, exactly: Client (raison sociale), Numéro à porter, Numéro court,
Contrôle N°, Equipement, Adresse MAC équipement, Utilisateur, Hébergeur source, Hébergeur cible,
Bascule des numéros, Date bascule, Commentaires.

Mapping decision (not in SPEC.md verbatim, made explicit here since both `Client` and `Numero` carry
overlapping fields): `Hébergeur source`/`Hébergeur cible` come from `Client` (applies at the client
level); `Bascule des numéros`/`Date bascule`/`Commentaires` come from `Numero` (per-row granularity,
matching the grid being "une ligne par enregistrement").

Known simplification: the row format has one `Equipement`/`Adresse MAC équipement` column pair, so
a `Utilisateur` with more than one `Equipement` can only show one of them on their `Numero` row
(Task 7's repository picks whichever the query returns last for that `utilisateurId` — arbitrary,
not a meaningful business rule). This isn't a SPEC.md-documented case for the outbound direction;
revisit once real data from the reprise (§7.1, separate future work) shows whether it actually
occurs and how the source Sheet represents it.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/sync/provisionning.test.ts
import { describe, test, expect } from "bun:test";
import { buildProvisionningRows, PROVISIONNING_HEADERS } from "./provisionning";

describe("buildProvisionningRows", () => {
  test("maps a numero row with equipement and utilisateur", () => {
    const rows = buildProvisionningRows(
      [
        {
          clientRaisonSociale: "ACME SARL",
          numeroBrut: "01 80 87 33 45",
          numerosCourts: ["401", "423"],
          controleNiveau: "OK",
          equipementModeleLibelle: "Yealink T57W",
          equipementMacBrut: "80:5E:0C:53:D6:70",
          utilisateurNom: "BAUDON Émilie",
          hebergeurSource: "SEWAN",
          hebergeurCible: "UNYC",
          statutBascule: "Fait",
          dateBascule: new Date("2026-01-15"),
          commentaire: null,
        },
      ],
      []
    );

    expect(rows).toEqual([
      [
        "ACME SARL",
        "01 80 87 33 45",
        "401/423",
        "OK",
        "Yealink T57W",
        "80:5E:0C:53:D6:70",
        "BAUDON Émilie",
        "SEWAN",
        "UNYC",
        "Fait",
        "2026-01-15",
        "",
      ],
    ]);
  });

  test("appends orphan equipement rows after numero rows, sparse columns", () => {
    const rows = buildProvisionningRows(
      [],
      [
        {
          clientRaisonSociale: "ACME SARL",
          equipementModeleLibelle: "Yealink W90B",
          equipementMacBrut: "030AD2466B",
          commentaire: "Borne DECT accueil",
        },
      ]
    );

    expect(rows).toEqual([
      ["ACME SARL", "", "", "", "Yealink W90B", "030AD2466B", "", "", "", "", "", "Borne DECT accueil"],
    ]);
  });

  test("headers match SPEC.md §3.1 column order", () => {
    expect(PROVISIONNING_HEADERS).toEqual([
      "Client (raison sociale)",
      "Numéro à porter",
      "Numéro court",
      "Contrôle N°",
      "Equipement",
      "Adresse MAC équipement",
      "Utilisateur",
      "Hébergeur source",
      "Hébergeur cible",
      "Bascule des numéros",
      "Date bascule",
      "Commentaires",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test lib/domain/sync/provisionning.test.ts
```

Expected: FAIL — `provisionning.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/domain/sync/provisionning.ts
export const PROVISIONNING_HEADERS = [
  "Client (raison sociale)",
  "Numéro à porter",
  "Numéro court",
  "Contrôle N°",
  "Equipement",
  "Adresse MAC équipement",
  "Utilisateur",
  "Hébergeur source",
  "Hébergeur cible",
  "Bascule des numéros",
  "Date bascule",
  "Commentaires",
];

export interface ProvisionningNumeroRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  numerosCourts: string[];
  controleNiveau: "OK" | "AVERTISSEMENT" | "ERREUR";
  equipementModeleLibelle: string | null;
  equipementMacBrut: string | null;
  utilisateurNom: string | null;
  hebergeurSource: string;
  hebergeurCible: string;
  statutBascule: string;
  dateBascule: Date | null;
  commentaire: string | null;
}

export interface ProvisionningEquipementRow {
  clientRaisonSociale: string;
  equipementModeleLibelle: string | null;
  equipementMacBrut: string;
  commentaire: string | null;
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function buildProvisionningRows(
  numeros: ProvisionningNumeroRow[],
  equipementsOrphelins: ProvisionningEquipementRow[]
): string[][] {
  const numeroRows = numeros.map((n) => [
    n.clientRaisonSociale,
    n.numeroBrut,
    n.numerosCourts.join("/"),
    n.controleNiveau,
    n.equipementModeleLibelle ?? "",
    n.equipementMacBrut ?? "",
    n.utilisateurNom ?? "",
    n.hebergeurSource,
    n.hebergeurCible,
    n.statutBascule,
    formatDate(n.dateBascule),
    n.commentaire ?? "",
  ]);

  const equipementRows = equipementsOrphelins.map((e) => [
    e.clientRaisonSociale,
    "",
    "",
    "",
    e.equipementModeleLibelle ?? "",
    e.equipementMacBrut,
    "",
    "",
    "",
    "",
    "",
    e.commentaire ?? "",
  ]);

  return [...numeroRows, ...equipementRows];
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
bun test lib/domain/sync/provisionning.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/sync/provisionning.ts lib/domain/sync/provisionning.test.ts
git commit -m "feat: add Provisionning tab mapping"
```

---

## Task 4: Clients tab mapping

**Files:**
- Create: `lib/domain/sync/clients.ts`
- Test: `lib/domain/sync/clients.test.ts`

**Interfaces:**
- Produces: `CLIENTS_HEADERS: string[]`, `ClientSyncRow` type, and
  `buildClientsRows(clients: ClientSyncRow[]): string[][]`.

Column order per SPEC.md §3.2: raison sociale, lot, nb numéros, nb MAC saisis, nb MAC distincts,
bascules faites, statut global, scénario, adresse, contact, nb postes annoncé Monday, écart.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/sync/clients.test.ts
import { describe, test, expect } from "bun:test";
import { buildClientsRows, CLIENTS_HEADERS } from "./clients";

describe("buildClientsRows", () => {
  test("maps a client row with computed counts", () => {
    const rows = buildClientsRows([
      {
        raisonSociale: "ACME SARL",
        lotNom: "LOT 1a",
        nbNumeros: 21,
        nbMacSaisis: 23,
        nbMacDistincts: 22,
        nbBasculesFaites: 5,
        statutGlobal: "En cours",
        scenario: "Migration",
        adresse: "1 rue de Paris",
        contactNom: "MARTIN",
        contactPrenom: "Jean",
        nbPostesAnnonce: 20,
        nbEquipements: 22,
      },
    ]);

    expect(rows).toEqual([
      [
        "ACME SARL",
        "LOT 1a",
        "21",
        "23",
        "22",
        "5",
        "En cours",
        "Migration",
        "1 rue de Paris",
        "MARTIN Jean",
        "20",
        "-2",
      ],
    ]);
  });

  test("blanks out missing optional fields", () => {
    const rows = buildClientsRows([
      {
        raisonSociale: "SZUMNY GABRIEL PERI",
        lotNom: null,
        nbNumeros: 0,
        nbMacSaisis: 0,
        nbMacDistincts: 0,
        nbBasculesFaites: 0,
        statutGlobal: "À faire",
        scenario: null,
        adresse: null,
        contactNom: null,
        contactPrenom: null,
        nbPostesAnnonce: null,
        nbEquipements: 0,
      },
    ]);

    expect(rows).toEqual([
      ["SZUMNY GABRIEL PERI", "", "0", "0", "0", "0", "À faire", "", "", "", "", ""],
    ]);
  });

  test("headers match SPEC.md §3.2 column order", () => {
    expect(CLIENTS_HEADERS).toEqual([
      "Raison sociale",
      "Lot",
      "Nb numéros",
      "MAC saisis",
      "MAC distincts",
      "Bascules faites",
      "Statut global",
      "Scénario",
      "Adresse",
      "Contact",
      "Nb postes annoncé (Monday)",
      "Écart postes/équipements",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test lib/domain/sync/clients.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/domain/sync/clients.ts
export const CLIENTS_HEADERS = [
  "Raison sociale",
  "Lot",
  "Nb numéros",
  "MAC saisis",
  "MAC distincts",
  "Bascules faites",
  "Statut global",
  "Scénario",
  "Adresse",
  "Contact",
  "Nb postes annoncé (Monday)",
  "Écart postes/équipements",
];

export interface ClientSyncRow {
  raisonSociale: string;
  lotNom: string | null;
  nbNumeros: number;
  nbMacSaisis: number;
  nbMacDistincts: number;
  nbBasculesFaites: number;
  statutGlobal: string;
  scenario: string | null;
  adresse: string | null;
  contactNom: string | null;
  contactPrenom: string | null;
  nbPostesAnnonce: number | null;
  nbEquipements: number;
}

function contact(nom: string | null, prenom: string | null): string {
  return [nom, prenom].filter(Boolean).join(" ");
}

export function buildClientsRows(clients: ClientSyncRow[]): string[][] {
  return clients.map((c) => [
    c.raisonSociale,
    c.lotNom ?? "",
    String(c.nbNumeros),
    String(c.nbMacSaisis),
    String(c.nbMacDistincts),
    String(c.nbBasculesFaites),
    c.statutGlobal,
    c.scenario ?? "",
    c.adresse ?? "",
    contact(c.contactNom, c.contactPrenom),
    c.nbPostesAnnonce === null ? "" : String(c.nbPostesAnnonce),
    c.nbPostesAnnonce === null ? "" : String(c.nbPostesAnnonce - c.nbEquipements),
  ]);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
bun test lib/domain/sync/clients.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/sync/clients.ts lib/domain/sync/clients.test.ts
git commit -m "feat: add Clients tab mapping"
```

---

## Task 5: Téléphone tab mapping

**Files:**
- Create: `lib/domain/sync/telephone.ts`
- Test: `lib/domain/sync/telephone.test.ts`

**Interfaces:**
- Produces: `buildTelephoneHeaders(etapeLibelles: string[]): string[]`, `TelephoneUtilisateurRow`
  type, and `buildTelephoneRows(utilisateurs: TelephoneUtilisateurRow[], etapeLibelles: string[]): string[][]`.

Columns are dynamic (one per active `EtapeModele`, ordered by `ordre`) per SPEC.md §3.3, so headers
aren't a fixed constant here — they're built from whatever steps exist, unlike the other four tabs.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/sync/telephone.test.ts
import { describe, test, expect } from "bun:test";
import { buildTelephoneHeaders, buildTelephoneRows } from "./telephone";

describe("buildTelephoneHeaders", () => {
  test("prefixes the fixed columns before the dynamic step columns", () => {
    expect(buildTelephoneHeaders(["Créer les utilisateurs", "Mettre les équipements"])).toEqual([
      "Client (raison sociale)",
      "Utilisateur",
      "Créer les utilisateurs",
      "Mettre les équipements",
    ]);
  });
});

describe("buildTelephoneRows", () => {
  test("fills known statuts and defaults missing ones to À faire", () => {
    const rows = buildTelephoneRows(
      [
        {
          clientRaisonSociale: "ACME SARL",
          utilisateurNom: "BAUDON Émilie",
          statutsParEtape: { "Créer les utilisateurs": "Fait" },
        },
      ],
      ["Créer les utilisateurs", "Mettre les équipements"]
    );

    expect(rows).toEqual([["ACME SARL", "BAUDON Émilie", "Fait", "À faire"]]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test lib/domain/sync/telephone.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/domain/sync/telephone.ts
export interface TelephoneUtilisateurRow {
  clientRaisonSociale: string;
  utilisateurNom: string;
  statutsParEtape: Record<string, string>;
}

export function buildTelephoneHeaders(etapeLibelles: string[]): string[] {
  return ["Client (raison sociale)", "Utilisateur", ...etapeLibelles];
}

export function buildTelephoneRows(
  utilisateurs: TelephoneUtilisateurRow[],
  etapeLibelles: string[]
): string[][] {
  return utilisateurs.map((u) => [
    u.clientRaisonSociale,
    u.utilisateurNom,
    ...etapeLibelles.map((etape) => u.statutsParEtape[etape] ?? "À faire"),
  ]);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
bun test lib/domain/sync/telephone.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/sync/telephone.ts lib/domain/sync/telephone.test.ts
git commit -m "feat: add Téléphone tab mapping"
```

---

## Task 6: Shared SDA/MAC export mapping

**Files:**
- Create: `lib/domain/exports/sda.ts`
- Create: `lib/domain/exports/mac.ts`
- Test: `lib/domain/exports/sda.test.ts`
- Test: `lib/domain/exports/mac.test.ts`

**Interfaces:**
- Produces: `SDA_HEADERS`, `SdaSourceRow` type, `buildSdaRows(rows: SdaSourceRow[]): string[][]`
  (sorts by raison sociale, no dedup needed — one row per eligible numero already).
- Produces: `MAC_HEADERS`, `MacSourceRow` type, `buildMacRows(rows: MacSourceRow[]): string[][]`
  (preserves input order — caller supplies client/equipement order already, per §6.3 "ordre de
  saisie"; dedupes by `macNormalise` within each client).

Both functions take pre-filtered input (eligibility filtering — `ModeleEquipement.eligibleExport`
— happens in the repository layer, Task 7, since it needs a database join). These functions handle
only sort order (SDA) and dedup (MAC), per SPEC.md §6.2/§6.3.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/exports/sda.test.ts
import { describe, test, expect } from "bun:test";
import { buildSdaRows, SDA_HEADERS } from "./sda";

describe("buildSdaRows", () => {
  test("sorts by raison sociale, preserves saisie order within a client", () => {
    const rows = buildSdaRows([
      { clientRaisonSociale: "ZETA SARL", numeroBrut: "0102030405", ordre: 0 },
      { clientRaisonSociale: "ACME SARL", numeroBrut: "0102030406", ordre: 1 },
      { clientRaisonSociale: "ACME SARL", numeroBrut: "0102030407", ordre: 0 },
    ]);

    expect(rows).toEqual([
      ["ACME SARL", "0102030407"],
      ["ACME SARL", "0102030406"],
      ["ZETA SARL", "0102030405"],
    ]);
  });

  test("headers match SPEC.md §6.2", () => {
    expect(SDA_HEADERS).toEqual(["Client (raison sociale)", "Numéro à porter"]);
  });
});
```

```typescript
// lib/domain/exports/mac.test.ts
import { describe, test, expect } from "bun:test";
import { buildMacRows, MAC_HEADERS } from "./mac";

describe("buildMacRows", () => {
  test("preserves input order, dedupes by macNormalise within a client", () => {
    const rows = buildMacRows([
      { clientRaisonSociale: "ACME SARL", macBrut: "80:5E:0C:53:D6:70", macNormalise: "805E0C53D670" },
      { clientRaisonSociale: "ACME SARL", macBrut: "80:5e:0c:53:d6:70", macNormalise: "805E0C53D670" },
      { clientRaisonSociale: "ZETA SARL", macBrut: "030AD2466B", macNormalise: "030AD2466B" },
    ]);

    expect(rows).toEqual([
      ["ACME SARL", "80:5E:0C:53:D6:70"],
      ["ZETA SARL", "030AD2466B"],
    ]);
  });

  test("headers match SPEC.md §6.3", () => {
    expect(MAC_HEADERS).toEqual(["Client (raison sociale)", "Adresse MAC équipement"]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
bun test lib/domain/exports/sda.test.ts lib/domain/exports/mac.test.ts
```

Expected: FAIL — neither file exists yet.

- [ ] **Step 3: Write the implementations**

```typescript
// lib/domain/exports/sda.ts
export const SDA_HEADERS = ["Client (raison sociale)", "Numéro à porter"];

export interface SdaSourceRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  ordre: number;
}

export function buildSdaRows(rows: SdaSourceRow[]): string[][] {
  return [...rows]
    .sort((a, b) => {
      const byName = a.clientRaisonSociale.localeCompare(b.clientRaisonSociale, "fr");
      return byName !== 0 ? byName : a.ordre - b.ordre;
    })
    .map((r) => [r.clientRaisonSociale, r.numeroBrut]);
}
```

```typescript
// lib/domain/exports/mac.ts
export const MAC_HEADERS = ["Client (raison sociale)", "Adresse MAC équipement"];

export interface MacSourceRow {
  clientRaisonSociale: string;
  macBrut: string;
  macNormalise: string;
}

export function buildMacRows(rows: MacSourceRow[]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const r of rows) {
    const key = `${r.clientRaisonSociale} ${r.macNormalise}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([r.clientRaisonSociale, r.macBrut]);
  }

  return result;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
bun test lib/domain/exports/sda.test.ts lib/domain/exports/mac.test.ts
```

Expected: PASS, 4 tests total.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/exports/sda.ts lib/domain/exports/mac.ts lib/domain/exports/sda.test.ts lib/domain/exports/mac.test.ts
git commit -m "feat: add shared SDA/MAC export mapping"
```

---

## Task 7: Sync repository

**Files:**
- Create: `lib/repositories/syncRepository.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts` (existing singleton).
- Produces: five async functions, one per tab, each returning exactly the input shape its Task
  3-6 mapping function expects:
  - `fetchProvisionningData(): Promise<{ numeros: ProvisionningNumeroRow[]; equipementsOrphelins: ProvisionningEquipementRow[] }>`
  - `fetchClientsData(): Promise<ClientSyncRow[]>`
  - `fetchTelephoneData(): Promise<{ utilisateurs: TelephoneUtilisateurRow[]; etapeLibelles: string[] }>`
  - `fetchSdaData(): Promise<SdaSourceRow[]>`
  - `fetchMacData(): Promise<MacSourceRow[]>`

Only active (`archiveA: null`) clients/numeros/equipements/utilisateurs are included, per CLAUDE.md's
"suppression logique via archiveA" invariant — archived rows never appear in an export or sync.

- [ ] **Step 1: Write the repository**

```typescript
// lib/repositories/syncRepository.ts
import { prisma } from "@/lib/prisma";
import type {
  ProvisionningNumeroRow,
  ProvisionningEquipementRow,
} from "@/lib/domain/sync/provisionning";
import type { ClientSyncRow } from "@/lib/domain/sync/clients";
import type { TelephoneUtilisateurRow } from "@/lib/domain/sync/telephone";
import type { SdaSourceRow } from "@/lib/domain/exports/sda";
import type { MacSourceRow } from "@/lib/domain/exports/mac";

export async function fetchProvisionningData(): Promise<{
  numeros: ProvisionningNumeroRow[];
  equipementsOrphelins: ProvisionningEquipementRow[];
}> {
  const numeros = await prisma.numero.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    include: {
      client: true,
      utilisateur: true,
    },
  });

  const equipementsForNumeros = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      client: { archiveA: null },
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
    },
    include: { modele: true },
  });
  const equipementByUtilisateurId = new Map(
    equipementsForNumeros.map((e) => [e.utilisateurId as string, e])
  );

  const numeroRows: ProvisionningNumeroRow[] = numeros.map((n) => {
    const equipement = n.utilisateurId ? equipementByUtilisateurId.get(n.utilisateurId) : undefined;
    return {
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numerosCourts: n.numerosCourts,
      controleNiveau: n.controleNiveau,
      equipementModeleLibelle: equipement?.modele?.libelle ?? equipement?.modeleLibelleBrut ?? null,
      equipementMacBrut: equipement?.macBrut ?? null,
      utilisateurNom: n.utilisateur?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
    };
  });

  const orphanEquipements = await prisma.equipement.findMany({
    where: { archiveA: null, client: { archiveA: null }, utilisateurId: null },
    include: { client: true, modele: true },
  });

  const equipementRows: ProvisionningEquipementRow[] = orphanEquipements.map((e) => ({
    clientRaisonSociale: e.client.raisonSociale,
    equipementModeleLibelle: e.modele?.libelle ?? e.modeleLibelleBrut ?? null,
    equipementMacBrut: e.macBrut,
    commentaire: e.commentaire,
  }));

  return { numeros: numeroRows, equipementsOrphelins: equipementRows };
}

export async function fetchClientsData(): Promise<ClientSyncRow[]> {
  const clients = await prisma.client.findMany({
    where: { archiveA: null },
    include: {
      lot: true,
      numeros: { where: { archiveA: null } },
      equipements: { where: { archiveA: null } },
    },
  });

  return clients.map((c) => ({
    raisonSociale: c.raisonSociale,
    lotNom: c.lot?.nom ?? null,
    nbNumeros: c.numeros.length,
    nbMacSaisis: c.equipements.length,
    nbMacDistincts: new Set(c.equipements.map((e) => e.macNormalise)).size,
    nbBasculesFaites: c.numeros.filter((n) => n.statutBascule === "Fait").length,
    statutGlobal: c.statutBascule,
    scenario: c.scenario,
    adresse: c.adresse,
    contactNom: c.contactNom,
    contactPrenom: c.contactPrenom,
    nbPostesAnnonce: c.nbPostesAnnonce,
    nbEquipements: c.equipements.length,
  }));
}

export async function fetchTelephoneData(): Promise<{
  utilisateurs: TelephoneUtilisateurRow[];
  etapeLibelles: string[];
}> {
  const etapes = await prisma.etapeModele.findMany({
    where: { actif: true },
    orderBy: { ordre: "asc" },
  });
  const etapeLibelles = etapes.map((e) => e.libelle);

  const utilisateurs = await prisma.utilisateur.findMany({
    where: { archiveA: null, client: { archiveA: null } },
    include: { client: true, suivis: { include: { etape: true } } },
  });

  const rows: TelephoneUtilisateurRow[] = utilisateurs.map((u) => {
    const statutsParEtape: Record<string, string> = {};
    for (const suivi of u.suivis) {
      statutsParEtape[suivi.etape.libelle] = suivi.statut;
    }
    return {
      clientRaisonSociale: u.client.raisonSociale,
      utilisateurNom: u.nom,
      statutsParEtape,
    };
  });

  return { utilisateurs: rows, etapeLibelles };
}

export async function fetchSdaData(): Promise<SdaSourceRow[]> {
  const numeros = await prisma.numero.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: { archiveA: null },
      utilisateurId: { not: null },
    },
    include: { client: true },
  });

  const eligibleEquipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      utilisateurId: { in: numeros.map((n) => n.utilisateurId).filter((id): id is string => id !== null) },
      modele: { eligibleExport: true },
    },
    select: { utilisateurId: true },
  });
  const eligibleUtilisateurIds = new Set(eligibleEquipements.map((e) => e.utilisateurId));

  return numeros
    .filter((n) => n.utilisateurId && eligibleUtilisateurIds.has(n.utilisateurId))
    .map((n) => ({
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      ordre: n.ordre,
    }));
}

export async function fetchMacData(): Promise<MacSourceRow[]> {
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      exclureExport: false,
      client: { archiveA: null },
      modele: { eligibleExport: true },
    },
    include: { client: true },
    orderBy: [{ client: { creeLe: "asc" } }, { ordre: "asc" }],
  });

  return equipements.map((e) => ({
    clientRaisonSociale: e.client.raisonSociale,
    macBrut: e.macBrut,
    macNormalise: e.macNormalise,
  }));
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit
```

Expected: no type errors. If a Prisma query shape doesn't match (e.g. a relation name typo), fix
against the actual generated types in `node_modules/.prisma/client` — don't guess field names from
memory, read `prisma/schema.prisma` again if unsure.

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/syncRepository.ts
git commit -m "feat: add sync repository"
```

---

## Task 8: Sync orchestrator

**Files:**
- Create: `lib/sync/runSheetsSync.ts`

**Interfaces:**
- Consumes: all five `fetch*Data` functions (Task 7), all five `build*Rows`/`build*Headers`
  functions (Tasks 3-6), `writeSheetTabs` (Task 2), `prisma` (existing).
- Produces: `runSheetsSync(declencheur: "MANUEL" | "CRON" | "CLI", auteurId?: string): Promise<SheetSyncRunResult>`
  — Task 9's route handler and CLI script both call this.

- [ ] **Step 1: Write the orchestrator**

```typescript
// lib/sync/runSheetsSync.ts
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
  erreurs: Record<string, string>;
}

async function buildTab(
  tabName: string,
  headers: string[],
  rows: string[][]
): Promise<SheetTabWrite> {
  return { tabName, banner: BANNER, headers, rows };
}

export async function runSheetsSync(
  declencheur: "MANUEL" | "CRON" | "CLI",
  auteurId?: string
): Promise<SheetSyncRunResult> {
  const ongletsEcrits: Record<string, number> = {};
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

  for (const { name, build } of builders) {
    try {
      const tab = await build();
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
      await writeSheetTabs(spreadsheetId, tabs);
    } catch (err) {
      erreurs["_global"] = err instanceof Error ? err.message : String(err);
    }
  }

  const succes = Object.keys(erreurs).length === 0;

  await prisma.sheetSyncRun.create({
    data: {
      declencheur,
      ongletsEcrits,
      erreurs: Object.keys(erreurs).length > 0 ? erreurs : undefined,
      succes,
      auteurId: auteurId ?? null,
    },
  });

  return { succes, ongletsEcrits, erreurs };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/sync/runSheetsSync.ts
git commit -m "feat: add sync orchestrator"
```

---

## Task 9: Trigger surfaces — cron endpoint and CLI script

**Files:**
- Create: `app/api/cron/sheets-sync/route.ts`
- Modify: `package.json` (add `sync:sheets` script)

**Interfaces:**
- Consumes: `runSheetsSync` (Task 8).

- [ ] **Step 1: Write the cron endpoint**

```typescript
// app/api/cron/sheets-sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runSheetsSync } from "@/lib/sync/runSheetsSync";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Cron-Secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSheetsSync("CRON");
  return NextResponse.json(result, { status: result.succes ? 200 : 207 });
}
```

- [ ] **Step 2: Write the CLI script**

Create `scripts/sync-sheets.ts`:

```typescript
// scripts/sync-sheets.ts
import { runSheetsSync } from "../lib/sync/runSheetsSync";

runSheetsSync("CLI")
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.succes ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

Add to `package.json` `scripts`:

```json
"sync:sheets": "bun run scripts/sync-sheets.ts"
```

- [ ] **Step 3: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Verify the build still succeeds**

```bash
bun run build
```

Expected: succeeds, route table includes `POST /api/cron/sheets-sync` as dynamic (`ƒ`).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/sheets-sync scripts/sync-sheets.ts package.json
git commit -m "feat: add sync trigger surfaces (cron endpoint, CLI script)"
```

---

## Task 10: Apply migration and verify against the real Sheet

This task touches real infrastructure: applies a schema migration to the live production database
and writes to the real Google Sheet. Confirm with the user before running Steps 2 onward — Step 1
is local/read-only.

**Files:** none (infra-only)

- [ ] **Step 1: Run local unit tests one more time**

```bash
bun test
```

Expected: all tests from Tasks 3-6 pass (11 tests total: 3 Provisionning + 3 Clients + 2 Téléphone +
2 SDA + 2 MAC... count whatever the actual suite reports and confirm it matches the sum of tests
written in this plan).

- [ ] **Step 2: Get a fresh database connection string**

```bash
cd /home/dev/Developpement/Projet/Everlink
bunx @prisma/cli@latest database connection create "Primary database" --name everlink-sync-migrate --project proj_cms4grybr13xb06f3x712e3u0
```

This prints a connection string once — capture it, don't paste it into any committed file or into
your report file.

```bash
export DATABASE_URL="<value printed above>"
```

- [ ] **Step 3: Apply the migration**

```bash
bunx prisma migrate deploy
```

Expected: applies the `<timestamp>_sheet_sync_run` migration, prints "1 migration found... applied".

- [ ] **Step 4: Deploy the app**

```bash
bunx @prisma/cli@latest app deploy --project proj_cms4grybr13xb06f3x712e3u0 --region eu-west-3 --branch main --prod --yes
```

- [ ] **Step 5: Trigger a real sync via the cron endpoint and verify**

```bash
curl -sS -X POST -H "X-Cron-Secret: <value of CRON_SECRET>" https://m1c0fnkdysq710fd20ol73yh.cdg.prisma.build/api/cron/sheets-sync
```

Note: `CRON_SECRET` was never set as a production env var in any prior task on this plan or the
previous one — check `bunx @prisma/cli@latest project env list --role production` first; if it's
missing, generate and set one the same way `AUTH_SECRET` was set (`openssl rand -base64 32`,
`project env add`), then redeploy before this step.

Expected: HTTP 200, JSON body with `succes: true` and `ongletsEcrits` showing 5 tab names each
mapped to `0` (empty database — expected, per this plan's scope decision to build sync before
reprise). If any tab shows an error, read it — it points at exactly which mapping or query broke.

- [ ] **Step 6: Verify the Sheet itself**

Open the Sheet (ID `1OLTKxWIHDOAV9RPB4_cDdU30vRqZxdd_W7-5MfFqsMo`) and confirm: five tabs exist
(Provisionning, Clients, Téléphone, Import SDA, Import MAC), each with the banner in row 1, correct
headers in row 2, no data rows (expected — empty database).

- [ ] **Step 7: Report**

Summarize what was verified (real command output, not just "it worked") back to the user.

---

## Self-Review Notes

- **Spec coverage:** all five tabs from the design doc have a task; both trigger surfaces (cron +
  CLI) are covered; schema, client wrapper, and real-infra verification each have their own task.
- **No placeholders:** every step has literal code or commands; the one open unknown (whether
  `--from-migrations` needs a shadow DB) has an explicit fallback, not a TBD.
- **Type consistency:** `ProvisionningNumeroRow`/`ProvisionningEquipementRow` (Task 3) are imported
  identically in Task 7's repository and consumed identically in Task 8's orchestrator. Same for
  `ClientSyncRow`, `TelephoneUtilisateurRow`, `SdaSourceRow`, `MacSourceRow`.
- **Known gap, intentionally out of scope:** `CRON_SECRET` was never set on Prisma Compute
  production in this plan or the prior scaffold plan — Task 10 Step 5 catches this and sets it if
  missing, rather than assuming it exists.
