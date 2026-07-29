# Login + Provisionning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the login page (route protection) and the Provisionning page (SPEC.md §3.1) — the
first real business page — with its Contrôle N° rule engine (§5), inline editing, filters, search,
row-add, and bulk actions.

**Architecture:** shadcn/ui + TanStack Table for the grid, Server Actions for every mutation (each
with its own explicit session check — Auth.js's route proxy does not protect Server Actions),
Auth.js's proxy file for page-level route protection, a pure rule-engine module for Contrôle N°,
and a repository layer between the page and Prisma.

**Tech Stack:** Next.js 16 App Router, `@tanstack/react-table` v8, shadcn/ui, Auth.js v5
(`next-auth@beta`, already wired), Prisma 7, `bun test` for the rule engine.

## Global Constraints

- Next.js 16 renamed `middleware.ts`/`middleware` to `proxy.ts`/`proxy` — use `proxy.ts`, not
  `middleware.ts` (verified against current authjs.dev/Next.js docs; this repo is on Next.js
  16.2.12).
- Every Server Action that mutates data must call `auth()` itself and reject if there's no
  session — the proxy only protects page navigation, not POST requests to Server Actions.
  (authjs.dev/getting-started/session-management/protecting)
- Domain logic (Contrôle N° rules) lives in `lib/domain/`, pure, no Prisma import. (CLAUDE.md)
- Data access lives in `lib/repositories/`; Server Actions orchestrate, no business rules inline.
  (CLAUDE.md)
- Libellés en français, identiques à SPEC.md/au Sheet d'origine, accents et ponctuation inclus.
  (CLAUDE.md)
- Densité de type tableur: lignes compactes, édition inline, pas de modale pour éditer une
  cellule. (CLAUDE.md)
- Toute action de masse est réversible ou confirmée. (CLAUDE.md) — ici: confirmée via
  `AlertDialog` avant exécution.
- Hors scope pour ce plan (voir design doc `docs/superpowers/specs/2026-07-29-login-provisionning-design.md`):
  coller depuis Excel, les six autres pages SPEC §3, la page Suivi client, l'écran de recalcul
  global du Contrôle N° (le recalcul reste déclenchable directement, pas d'écran dédié).

---

## Task 1: Seed script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts` (add `migrations.seed`)
- Modify: `package.json` (add `db:seed` script)

**Interfaces:**
- Produces: a runnable seed that creates one ADMIN `UtilisateurApp`, `ListeValeur` rows, and
  `ModeleEquipement` rows — every later task in this plan (login, Provisionning page) depends on
  this data existing.

- [ ] **Step 1: Write the seed script**

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const motDePasse = await bcrypt.hash("changeme", 10);
  await prisma.utilisateurApp.upsert({
    where: { email: "admin@everlink.local" },
    update: {},
    create: {
      email: "admin@everlink.local",
      nom: "Administrateur",
      motDePasse,
      role: "ADMIN",
    },
  });

  const listesValeurs: Array<{ categorie: string; valeur: string; ordre: number }> = [
    { categorie: "HEBERGEUR", valeur: "SEWAN", ordre: 0 },
    { categorie: "HEBERGEUR", valeur: "UNYC", ordre: 1 },
    { categorie: "STATUT_BASCULE", valeur: "À faire", ordre: 0 },
    { categorie: "STATUT_BASCULE", valeur: "Fait", ordre: 1 },
    { categorie: "SCENARIO", valeur: "Migration", ordre: 0 },
    { categorie: "TYPE_INTERVENTION", valeur: "Sur site", ordre: 0 },
    { categorie: "TYPE_INTERVENTION", valeur: "À distance", ordre: 1 },
    { categorie: "STATUT_MONDAY", valeur: "En cours", ordre: 0 },
    { categorie: "STATUT_MONDAY", valeur: "Terminé", ordre: 1 },
    { categorie: "TECHNO_LIEN", valeur: "Fibre", ordre: 0 },
    { categorie: "TECHNO_LIEN", valeur: "ADSL", ordre: 1 },
  ];
  for (const l of listesValeurs) {
    await prisma.listeValeur.upsert({
      where: { categorie_valeur: { categorie: l.categorie as never, valeur: l.valeur } },
      update: {},
      create: { categorie: l.categorie as never, valeur: l.valeur, ordre: l.ordre },
    });
  }

  const modeles: Array<{ libelle: string; marque: string; eligibleExport: boolean }> = [
    { libelle: "Yealink T57W", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W73H", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W90B", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W90DM", marque: "Yealink", eligibleExport: true },
    { libelle: "Panasonic TGP500", marque: "Panasonic", eligibleExport: false },
    { libelle: "Panasonic TGP600", marque: "Panasonic", eligibleExport: false },
    { libelle: "Polycom VVX400", marque: "Polycom", eligibleExport: false },
    { libelle: "Polycom IP5000", marque: "Polycom", eligibleExport: false },
    { libelle: "Polycom RealPresence Trio 8300", marque: "Polycom", eligibleExport: false },
    { libelle: "DOKO", marque: "DOKO", eligibleExport: false },
    { libelle: "FAX", marque: "FAX", eligibleExport: false },
    { libelle: "Aastra", marque: "Aastra", eligibleExport: false },
  ];
  for (const m of modeles) {
    await prisma.modeleEquipement.upsert({
      where: { libelle: m.libelle },
      update: {},
      create: { libelle: m.libelle, marque: m.marque, eligibleExport: m.eligibleExport },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Wire the seed command**

Edit `prisma.config.ts`, add a `migrations` block with `seed`:

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

Add to `package.json` `scripts`:

```json
"db:seed": "bunx prisma db seed"
```

- [ ] **Step 3: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts prisma.config.ts package.json
git commit -m "feat: add seed script (ADMIN account, ListeValeur, ModeleEquipement catalog)"
```

Running the seed against the real database is a real-infra step — deferred to the final task of
this plan, alongside deploy.

---

## Task 2: shadcn/ui setup

**Files:**
- Create: `components.json`, `lib/utils.ts` (both generated by `shadcn init`)
- Create: `components/ui/table.tsx`, `tooltip.tsx`, `select.tsx`, `alert-dialog.tsx`,
  `dropdown-menu.tsx`, `input.tsx`, `checkbox.tsx`, `badge.tsx`, `button.tsx` (generated by
  `shadcn add`)
- Modify: `package.json`, `app/globals.css` (CSS variables added by `shadcn init`)

**Interfaces:**
- Produces: the shadcn/ui component set every later task in this plan imports from
  `@/components/ui/*`.

- [ ] **Step 1: Initialize shadcn/ui**

```bash
bunx shadcn@latest init -y -d
```

`-y` skips confirmation prompts, `-d` uses default configuration (non-interactive, needed since
this runs without a TTY). If this prompts anyway, read the actual prompt text and add the missing
flag rather than guessing — check `bunx shadcn@latest init --help`.

- [ ] **Step 2: Add the components this plan needs**

```bash
bunx shadcn@latest add table tooltip select alert-dialog dropdown-menu input checkbox badge button -y
```

- [ ] **Step 3: Verify the build still succeeds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add components.json lib/utils.ts components/ui app/globals.css package.json bun.lock
git commit -m "chore: add shadcn/ui and base components"
```

---

## Task 3: Login page and route protection

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `proxy.ts` (repo root — NOT `middleware.ts`, see Global Constraints)

**Interfaces:**
- Consumes: `signIn`, `auth` from `@/auth` (already exported by the existing `auth.ts`).
- Produces: nothing later tasks import — this task is a leaf (the page itself), but it's a hard
  prerequisite for manually testing every later task, since nothing else is reachable without it.

- [ ] **Step 1: Write the login Server Action**

```typescript
// app/login/actions.ts
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Identifiants invalides." };
    }
    throw err;
  }
}
```

- [ ] **Step 2: Write the login page**

```typescript
// app/login/page.tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "20rem" }}>
        <h1>Everlink</h1>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" required />
        {state.error && <p style={{ color: "red" }}>{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
```

Plain HTML form elements for now — restyling with shadcn/ui `Input`/`Button`/`Label` (Task 2's
components) is a drop-in visual change later, not a behavior change, and isn't blocking.

- [ ] **Step 3: Write the route proxy**

```typescript
// proxy.ts
import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

The matcher excludes all of `/api/*` (not just `/api/auth/*`) — this also keeps
`/api/cron/sheets-sync` reachable without a browser session, which is correct: it authenticates
via its own `X-Cron-Secret` header, not a user session.

- [ ] **Step 4: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add app/login proxy.ts
git commit -m "feat: add login page and route protection"
```

---

## Task 4: Contrôle N° rule engine

**Files:**
- Create: `lib/domain/controle/controleNumero.ts`
- Test: `lib/domain/controle/controleNumero.test.ts`

**Interfaces:**
- Produces: `evaluerControle(numero: NumeroPourControle, contexte: ContexteControle): ResultatControle`
  — Task 6 (Provisionning page data fetching) calls this per row to populate the Contrôle N°
  column; Task 7 (inline editing) calls it after every save to recompute.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/domain/controle/controleNumero.test.ts
import { describe, test, expect } from "bun:test";
import { evaluerControle } from "./controleNumero";

describe("evaluerControle", () => {
  test("numéro valide, 10 chiffres commençant par 0, préfixe plausible", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: "u1", numerosCourts: ["401"] },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: ["401"] }
    );
    expect(result).toEqual({ niveau: "OK", detail: null });
  });

  test("numéro pas 10 chiffres après normalisation → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "018087334", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["018087334"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("10 chiffres");
  });

  test("numéro ne commence pas par 0 → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "1180873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["1180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
  });

  test("préfixe 06/07/08 → AVERTISSEMENT, pas bloquant", () => {
    const result = evaluerControle(
      { numeroNormalise: "0680873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["0680873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("préfixe");
  });

  test("doublon de numéro normalisé sur les lots actifs → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["0180873345", "0180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("doublon");
  });

  test("utilisateur renseigné sans équipement → AVERTISSEMENT", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: "u1", numerosCourts: [], aEquipement: false },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("cohérence");
  });

  test("numéro court dupliqué au sein du même client → AVERTISSEMENT", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: null, numerosCourts: ["401"] },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: ["401", "401"] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("numéro court");
  });

  test("plusieurs anomalies: le niveau le plus sévère gagne, le détail liste tout", () => {
    const result = evaluerControle(
      { numeroNormalise: "0680873345", utilisateurId: null, numerosCourts: [], aEquipement: false },
      { numerosNormalisesActifs: ["0680873345", "0680873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("doublon");
    expect(result.detail).toContain("préfixe");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
bun test lib/domain/controle/controleNumero.test.ts
```

Expected: FAIL — `controleNumero.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/domain/controle/controleNumero.ts
export type NiveauControle = "OK" | "AVERTISSEMENT" | "ERREUR";

export interface NumeroPourControle {
  numeroNormalise: string;
  utilisateurId: string | null;
  numerosCourts: string[];
  aEquipement?: boolean;
}

export interface ContexteControle {
  numerosNormalisesActifs: string[];
  numerosCourtsDuClient: string[];
}

export interface ResultatControle {
  niveau: NiveauControle;
  detail: string | null;
}

const SEVERITE: Record<NiveauControle, number> = { OK: 0, AVERTISSEMENT: 1, ERREUR: 2 };

export function evaluerControle(
  numero: NumeroPourControle,
  contexte: ContexteControle
): ResultatControle {
  const anomalies: Array<{ niveau: NiveauControle; message: string }> = [];

  if (!/^\d{10}$/.test(numero.numeroNormalise)) {
    anomalies.push({ niveau: "ERREUR", message: "Le numéro ne fait pas 10 chiffres." });
  } else if (!numero.numeroNormalise.startsWith("0")) {
    anomalies.push({ niveau: "ERREUR", message: "Le numéro ne commence pas par 0." });
  } else {
    const prefixe = numero.numeroNormalise.slice(0, 2);
    if (["06", "07", "08"].includes(prefixe)) {
      anomalies.push({
        niveau: "AVERTISSEMENT",
        message: `Le préfixe ${prefixe} n'est pas géographique.`,
      });
    }
  }

  const occurrences = contexte.numerosNormalisesActifs.filter(
    (n) => n === numero.numeroNormalise
  ).length;
  if (occurrences > 1) {
    anomalies.push({
      niveau: "ERREUR",
      message: "Ce numéro est en doublon sur les lots actifs.",
    });
  }

  if (numero.utilisateurId && numero.aEquipement === false) {
    anomalies.push({
      niveau: "AVERTISSEMENT",
      message: "Incohérence: un utilisateur est renseigné sans équipement.",
    });
  }

  for (const court of numero.numerosCourts) {
    const occurrencesCourt = contexte.numerosCourtsDuClient.filter((c) => c === court).length;
    if (occurrencesCourt > 1) {
      anomalies.push({
        niveau: "AVERTISSEMENT",
        message: `Le numéro court ${court} est en doublon pour ce client.`,
      });
    }
  }

  if (anomalies.length === 0) {
    return { niveau: "OK", detail: null };
  }

  const niveau = anomalies.reduce<NiveauControle>(
    (max, a) => (SEVERITE[a.niveau] > SEVERITE[max] ? a.niveau : max),
    "OK"
  );
  return { niveau, detail: anomalies.map((a) => a.message).join(" ") };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
bun test lib/domain/controle/controleNumero.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/controle
git commit -m "feat: add Contrôle N° rule engine"
```

---

## Task 5: Provisionning repository

**Files:**
- Create: `lib/repositories/provisionningRepository.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts`, `evaluerControle` from Task 4.
- Produces:
  - `ProvisionningLigne` type — one row's full display data (client, numéro, utilisateur,
    équipement, contrôle, etc.)
  - `fetchProvisionningLignes(filtres?: ProvisionningFiltres): Promise<ProvisionningLigne[]>`
  - `ProvisionningFiltres` type — `{ lotId?: string; clientId?: string; hebergeur?: string; statutBascule?: string; eligibleExportSeulement?: boolean; avecAnomalieSeulement?: boolean; recherche?: string }`

Task 6 (the page) calls `fetchProvisionningLignes`; Task 7-10 (editing, filters, add-row, bulk
actions) all read/write against the `Numero`/`Client`/`Utilisateur`/`Equipement` models this
repository queries.

- [ ] **Step 1: Write the repository**

```typescript
// lib/repositories/provisionningRepository.ts
import { prisma } from "@/lib/prisma";
import { evaluerControle, type NiveauControle } from "@/lib/domain/controle/controleNumero";

export interface ProvisionningFiltres {
  lotId?: string;
  clientId?: string;
  hebergeur?: string;
  statutBascule?: string;
  eligibleExportSeulement?: boolean;
  avecAnomalieSeulement?: boolean;
  recherche?: string;
}

export interface ProvisionningLigne {
  numeroId: string;
  clientId: string;
  clientRaisonSociale: string;
  numeroBrut: string;
  numeroNormalise: string;
  numerosCourts: string[];
  controleNiveau: NiveauControle;
  controleDetail: string | null;
  controleForce: boolean;
  equipementId: string | null;
  equipementLibelle: string | null;
  equipementMacBrut: string | null;
  utilisateurId: string | null;
  utilisateurNom: string | null;
  hebergeurSource: string;
  hebergeurCible: string;
  statutBascule: string;
  dateBascule: Date | null;
  commentaire: string | null;
  exclureExport: boolean;
}

export async function fetchProvisionningLignes(
  filtres: ProvisionningFiltres = {}
): Promise<ProvisionningLigne[]> {
  const numeros = await prisma.numero.findMany({
    where: {
      archiveA: null,
      client: {
        archiveA: null,
        ...(filtres.clientId ? { id: filtres.clientId } : {}),
        ...(filtres.lotId ? { lotId: filtres.lotId } : {}),
        ...(filtres.hebergeur ? { hebergeurCible: filtres.hebergeur } : {}),
      },
      ...(filtres.statutBascule ? { statutBascule: filtres.statutBascule } : {}),
      ...(filtres.recherche
        ? {
            OR: [
              { numeroBrut: { contains: filtres.recherche, mode: "insensitive" } },
              { client: { raisonSociale: { contains: filtres.recherche, mode: "insensitive" } } },
              { utilisateur: { nom: { contains: filtres.recherche, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { client: true, utilisateur: true },
    orderBy: [{ client: { raisonSociale: "asc" } }, { ordre: "asc" }, { id: "asc" }],
  });

  const utilisateurIds = numeros
    .map((n) => n.utilisateurId)
    .filter((id): id is string => id !== null);
  const equipements = await prisma.equipement.findMany({
    where: {
      archiveA: null,
      utilisateurId: { in: utilisateurIds },
      utilisateur: { archiveA: null },
      ...(filtres.eligibleExportSeulement ? { modele: { eligibleExport: true } } : {}),
    },
    include: { modele: true },
    orderBy: [{ ordre: "asc" }, { id: "asc" }],
  });
  const equipementParUtilisateur = new Map(equipements.map((e) => [e.utilisateurId as string, e]));

  const numerosNormalisesActifs = numeros.map((n) => n.numeroNormalise);
  const numerosCourtsParClient = new Map<string, string[]>();
  for (const n of numeros) {
    const liste = numerosCourtsParClient.get(n.clientId) ?? [];
    numerosCourtsParClient.set(n.clientId, [...liste, ...n.numerosCourts]);
  }

  const lignes: ProvisionningLigne[] = numeros.map((n) => {
    const equipement = n.utilisateurId ? equipementParUtilisateur.get(n.utilisateurId) : undefined;
    const utilisateurActif = n.utilisateur && n.utilisateur.archiveA === null ? n.utilisateur : null;

    const resultat = n.controleForce
      ? { niveau: n.controleNiveau, detail: n.controleDetail }
      : evaluerControle(
          {
            numeroNormalise: n.numeroNormalise,
            utilisateurId: n.utilisateurId,
            numerosCourts: n.numerosCourts,
            aEquipement: n.utilisateurId ? Boolean(equipement) : undefined,
          },
          {
            numerosNormalisesActifs,
            numerosCourtsDuClient: numerosCourtsParClient.get(n.clientId) ?? [],
          }
        );

    return {
      numeroId: n.id,
      clientId: n.clientId,
      clientRaisonSociale: n.client.raisonSociale,
      numeroBrut: n.numeroBrut,
      numeroNormalise: n.numeroNormalise,
      numerosCourts: n.numerosCourts,
      controleNiveau: resultat.niveau,
      controleDetail: resultat.detail,
      controleForce: n.controleForce,
      equipementId: equipement?.id ?? null,
      equipementLibelle: equipement?.modele?.libelle ?? equipement?.modeleLibelleBrut ?? null,
      equipementMacBrut: equipement?.macBrut ?? null,
      utilisateurId: utilisateurActif?.id ?? null,
      utilisateurNom: utilisateurActif?.nom ?? null,
      hebergeurSource: n.client.hebergeurSource,
      hebergeurCible: n.client.hebergeurCible,
      statutBascule: n.statutBascule,
      dateBascule: n.dateBascule,
      commentaire: n.commentaire,
      exclureExport: n.exclureExport,
    };
  });

  if (filtres.avecAnomalieSeulement) {
    return lignes.filter((l) => l.controleNiveau !== "OK");
  }
  return lignes;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/repositories/provisionningRepository.ts
git commit -m "feat: add Provisionning repository"
```

---

## Task 6: Provisionning page — read-only grid

**Files:**
- Create: `app/page.tsx` (replaces the current health-check page)
- Create: `app/provisionning/ProvisionningTable.tsx` (client component, the TanStack Table)

**Interfaces:**
- Consumes: `fetchProvisionningLignes`, `ProvisionningLigne` (Task 5).
- Produces: `ProvisionningTable` component with props `{ lignes: ProvisionningLigne[] }` — Tasks
  7-10 all extend this same component (inline editing, filters, add-row, bulk actions all live in
  it, since a tabular grid's features aren't independently addressable pieces).

- [ ] **Step 1: Write the page (Server Component)**

```typescript
// app/page.tsx
import { fetchProvisionningLignes } from "@/lib/repositories/provisionningRepository";
import { ProvisionningTable } from "@/app/provisionning/ProvisionningTable";

export const dynamic = "force-dynamic";

export default async function ProvisionningPage() {
  const lignes = await fetchProvisionningLignes();
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Provisionning</h1>
      <ProvisionningTable lignes={lignes} />
    </main>
  );
}
```

- [ ] **Step 2: Write the table component**

```typescript
// app/provisionning/ProvisionningTable.tsx
"use client";

import { Fragment, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProvisionningLigne } from "@/lib/repositories/provisionningRepository";

const NIVEAU_COULEUR: Record<string, "default" | "secondary" | "destructive"> = {
  OK: "default",
  AVERTISSEMENT: "secondary",
  ERREUR: "destructive",
};

const columns: ColumnDef<ProvisionningLigne>[] = [
  { header: "Client (raison sociale)", accessorKey: "clientRaisonSociale" },
  { header: "Numéro à porter", accessorKey: "numeroBrut" },
  {
    header: "Numéro court",
    accessorFn: (row) => row.numerosCourts.join("/"),
  },
  {
    header: "Contrôle N°",
    id: "controle",
    cell: ({ row }) => {
      const { controleNiveau, controleDetail } = row.original;
      const badge = <Badge variant={NIVEAU_COULEUR[controleNiveau]}>{controleNiveau}</Badge>;
      if (!controleDetail) return badge;
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{controleDetail}</TooltipContent>
        </Tooltip>
      );
    },
  },
  { header: "Equipement", accessorKey: "equipementLibelle" },
  { header: "Adresse MAC équipement", accessorKey: "equipementMacBrut" },
  { header: "Utilisateur", accessorKey: "utilisateurNom" },
  { header: "Hébergeur source", accessorKey: "hebergeurSource" },
  { header: "Hébergeur cible", accessorKey: "hebergeurCible" },
  { header: "Bascule des numéros", accessorKey: "statutBascule" },
  {
    header: "Date bascule",
    accessorFn: (row) => (row.dateBascule ? row.dateBascule.toISOString().slice(0, 10) : ""),
  },
  { header: "Commentaires", accessorKey: "commentaire" },
];

export function ProvisionningTable({ lignes }: { lignes: ProvisionningLigne[] }) {
  const data = useMemo(() => lignes, [lignes]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const groupes = useMemo(() => {
    const map = new Map<string, ProvisionningLigne[]>();
    for (const ligne of lignes) {
      const liste = map.get(ligne.clientRaisonSociale) ?? [];
      map.set(ligne.clientRaisonSociale, [...liste, ligne]);
    }
    return map;
  }, [lignes]);

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} style={{ textAlign: "left", padding: "0.25rem" }}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {Array.from(groupes.entries()).map(([raisonSociale, lignesDuClient]) => (
          <Fragment key={raisonSociale}>
            <tr style={{ background: "#f0f0f0" }}>
              <td colSpan={columns.length} style={{ padding: "0.25rem", fontWeight: "bold" }}>
                {raisonSociale} — {lignesDuClient.length} numéro(s),{" "}
                {lignesDuClient.filter((l) => l.equipementMacBrut).length} MAC,{" "}
                {lignesDuClient.filter((l) => l.statutBascule === "Fait").length} bascule(s) faite(s)
              </td>
            </tr>
            {table
              .getRowModel()
              .rows.filter((r) => r.original.clientRaisonSociale === raisonSociale)
              .map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: "0.25rem" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Install the TanStack Table dependency**

```bash
bun add @tanstack/react-table
```

- [ ] **Step 4: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/provisionning package.json bun.lock
git commit -m "feat: add Provisionning page (read-only grid)"
```

---

## Task 7: Inline editing

**Files:**
- Create: `app/provisionning/actions.ts`
- Modify: `app/provisionning/ProvisionningTable.tsx:*` (make editable cells)

**Interfaces:**
- Consumes: `auth` from `@/auth`, `prisma` from `@/lib/prisma`, `evaluerControle` from Task 4.
- Produces: `updateNumeroCellAction(numeroId: string, champ: string, valeur: string): Promise<{ success: boolean; error?: string }>`
  — Task 8 (force-OK) and Task 10 (add-line) both call variants of the same Server Action pattern
  established here.

- [ ] **Step 1: Write the Server Action**

```typescript
// app/provisionning/actions.ts
"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const CHAMPS_EDITABLES = [
  "commentaire",
  "statutBascule",
  "dateBascule",
] as const;
type ChampEditable = (typeof CHAMPS_EDITABLES)[number];

export async function updateNumeroCellAction(
  numeroId: string,
  champ: string,
  valeur: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }
  if (!CHAMPS_EDITABLES.includes(champ as ChampEditable)) {
    return { success: false, error: "Champ non éditable." };
  }

  try {
    const data: Record<string, string | Date> =
      champ === "dateBascule" ? { dateBascule: new Date(valeur) } : { [champ]: valeur };
    await prisma.numero.update({ where: { id: numeroId }, data });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
```

Only `commentaire`, `statutBascule`, `dateBascule` are editable in this task — `hebergeurSource`/
`hebergeurCible` live on `Client`, not `Numero`, and editing them here would silently affect every
other numéro of the same client; that's out of scope for a per-row inline edit and isn't attempted.

- [ ] **Step 2: Make the Commentaires and Bascule cells editable**

Replace the `commentaire` and `statutBascule` column definitions in `ProvisionningTable.tsx` with
editable cells:

```typescript
import { useState, useTransition } from "react";
import { updateNumeroCellAction } from "./actions";

function EditableCell({
  numeroId,
  champ,
  valeurInitiale,
}: {
  numeroId: string;
  champ: string;
  valeurInitiale: string;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enregistrer = () => {
    if (valeur === valeurInitiale) return;
    const valeurPrecedente = valeurInitiale;
    startTransition(async () => {
      const result = await updateNumeroCellAction(numeroId, champ, valeur);
      if (!result.success) {
        setValeur(valeurPrecedente);
        setErreur(result.error ?? "Échec de la sauvegarde.");
        setTimeout(() => setErreur(null), 3000);
      }
    });
  };

  return (
    <div>
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={enregistrer}
        onKeyDown={(e) => e.key === "Enter" && enregistrer()}
        disabled={isPending}
        style={{ width: "100%", border: "none", background: "transparent" }}
      />
      {erreur && <span style={{ color: "red", fontSize: "0.75rem" }}>{erreur}</span>}
    </div>
  );
}
```

Update the two column definitions:

```typescript
{
  header: "Bascule des numéros",
  id: "statutBascule",
  cell: ({ row }) => (
    <EditableCell
      numeroId={row.original.numeroId}
      champ="statutBascule"
      valeurInitiale={row.original.statutBascule}
    />
  ),
},
// ...
{
  header: "Commentaires",
  id: "commentaire",
  cell: ({ row }) => (
    <EditableCell
      numeroId={row.original.numeroId}
      champ="commentaire"
      valeurInitiale={row.original.commentaire ?? ""}
    />
  ),
},
```

- [ ] **Step 3: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add app/provisionning
git commit -m "feat: add inline editing to Provisionning grid"
```

---

## Task 8: Force-OK action on Contrôle N°

**Files:**
- Modify: `app/provisionning/actions.ts` (add `forcerControleAction`)
- Modify: `app/provisionning/ProvisionningTable.tsx` (add the dropdown on the Contrôle N° badge)

**Interfaces:**
- Consumes: `auth`, `prisma` (already imported in `actions.ts`).
- Produces: `forcerControleAction(numeroId: string, motif: string): Promise<{ success: boolean; error?: string }>`.

- [ ] **Step 1: Add the Server Action**

```typescript
// app/provisionning/actions.ts (append)
export async function forcerControleAction(
  numeroId: string,
  motif: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Non authentifié." };
  }
  if (!motif.trim()) {
    return { success: false, error: "Le motif est obligatoire." };
  }

  try {
    await prisma.numero.update({
      where: { id: numeroId },
      data: {
        controleNiveau: "OK",
        controleForce: true,
        controleMotif: motif,
        controlePar: session.user.id,
        controleLe: new Date(),
      },
    });
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
```

- [ ] **Step 2: Add the force-OK menu to the Contrôle N° cell**

Replace the `controle` column's `cell` function in `ProvisionningTable.tsx`:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { forcerControleAction } from "./actions";

function ControleCell({ ligne }: { ligne: ProvisionningLigne }) {
  const [isPending, startTransition] = useTransition();
  const badge = <Badge variant={NIVEAU_COULEUR[ligne.controleNiveau]}>{ligne.controleNiveau}</Badge>;

  const forcer = () => {
    const motif = window.prompt("Motif du forçage:");
    if (!motif) return;
    startTransition(async () => {
      await forcerControleAction(ligne.numeroId, motif);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {ligne.controleDetail ? (
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>{ligne.controleDetail}</TooltipContent>
          </Tooltip>
        ) : (
          badge
        )}
      </DropdownMenuTrigger>
      {ligne.controleNiveau !== "OK" && (
        <DropdownMenuContent>
          <DropdownMenuItem onClick={forcer} disabled={isPending}>
            Forcer OK
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
```

Update the column definition:

```typescript
{
  header: "Contrôle N°",
  id: "controle",
  cell: ({ row }) => <ControleCell ligne={row.original} />,
},
```

`window.prompt` is a placeholder interaction for the motif input — acceptable for this task since
SPEC only requires the motif be captured and stored, not a specific input UI; replacing it with a
proper `AlertDialog` + text field is a cosmetic follow-up, not a behavior gap.

- [ ] **Step 3: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add app/provisionning
git commit -m "feat: add force-OK action for Contrôle N°"
```

---

## Task 9: Filters and global search

**Files:**
- Modify: `app/page.tsx` (read filter params from the URL query string)
- Create: `app/provisionning/ProvisionningFiltres.tsx` (client component, filter bar)

**Interfaces:**
- Consumes: `ProvisionningFiltres` type (Task 5).
- Produces: nothing later tasks depend on — this is a leaf feature.

- [ ] **Step 1: Read filters from search params in the page**

```typescript
// app/page.tsx (replace)
import { fetchProvisionningLignes, type ProvisionningFiltres } from "@/lib/repositories/provisionningRepository";
import { ProvisionningTable } from "@/app/provisionning/ProvisionningTable";
import { ProvisionningFiltresBar } from "@/app/provisionning/ProvisionningFiltres";

export const dynamic = "force-dynamic";

export default async function ProvisionningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filtres: ProvisionningFiltres = {
    lotId: params.lot,
    clientId: params.client,
    hebergeur: params.hebergeur,
    statutBascule: params.statut,
    eligibleExportSeulement: params.eligible === "1",
    avecAnomalieSeulement: params.anomalie === "1",
    recherche: params.q,
  };
  const lignes = await fetchProvisionningLignes(filtres);
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Provisionning</h1>
      <ProvisionningFiltresBar />
      <ProvisionningTable lignes={lignes} />
    </main>
  );
}
```

- [ ] **Step 2: Write the filter bar**

```typescript
// app/provisionning/ProvisionningFiltres.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ProvisionningFiltresBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
      <input
        placeholder="Rechercher (numéro, MAC, utilisateur, raison sociale)"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => setParam("q", e.target.value)}
      />
      <select
        defaultValue={searchParams.get("hebergeur") ?? ""}
        onChange={(e) => setParam("hebergeur", e.target.value)}
      >
        <option value="">Hébergeur (tous)</option>
        <option value="SEWAN">SEWAN</option>
        <option value="UNYC">UNYC</option>
      </select>
      <select
        defaultValue={searchParams.get("statut") ?? ""}
        onChange={(e) => setParam("statut", e.target.value)}
      >
        <option value="">Statut bascule (tous)</option>
        <option value="À faire">À faire</option>
        <option value="Fait">Fait</option>
      </select>
      <label>
        <input
          type="checkbox"
          defaultChecked={searchParams.get("anomalie") === "1"}
          onChange={(e) => setParam("anomalie", e.target.checked ? "1" : "")}
        />
        Anomalies seulement
      </label>
      <label>
        <input
          type="checkbox"
          defaultChecked={searchParams.get("eligible") === "1"}
          onChange={(e) => setParam("eligible", e.target.checked ? "1" : "")}
        />
        Éligibles export seulement
      </label>
    </div>
  );
}
```

`lot`/`client` filters are query-param-ready (the repository already accepts `lotId`/`clientId`)
but have no `<select>` here since there's no Lots/Clients page yet to source option lists from —
add those two selects when Task 5's repository gets a companion "list active lots/clients" query,
out of scope for this task.

- [ ] **Step 3: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/provisionning/ProvisionningFiltres.tsx
git commit -m "feat: add filters and global search to Provisionning"
```

---

## Task 10: Add line (numéro seul, équipement seul, ligne complète)

**Files:**
- Modify: `app/provisionning/actions.ts` (add `ajouterLigneAction`)
- Modify: `app/provisionning/ProvisionningTable.tsx` (add the "+" button and menu)

**Interfaces:**
- Consumes: `prisma`, `auth` (already imported).
- Produces: `ajouterLigneAction(clientId: string, type: "numero" | "equipement" | "complete"): Promise<{ success: boolean; numeroId?: string; error?: string }>`.

- [ ] **Step 1: Add the Server Action**

```typescript
// app/provisionning/actions.ts (append)
export async function ajouterLigneAction(
  clientId: string,
  type: "numero" | "equipement" | "complete"
): Promise<{ success: boolean; numeroId?: string; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }

  try {
    if (type === "equipement") {
      await prisma.equipement.create({
        data: { clientId, macBrut: "", macNormalise: "" },
      });
      revalidatePath("/");
      return { success: true };
    }

    const numero = await prisma.numero.create({
      data: {
        clientId,
        numeroBrut: "",
        numeroNormalise: "",
      },
    });

    if (type === "complete") {
      await prisma.equipement.create({
        data: { clientId, macBrut: "", macNormalise: "", utilisateurId: null },
      });
    }

    revalidatePath("/");
    return { success: true, numeroId: numero.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
```

An empty `numeroBrut`/`macBrut` row is intentionally allowed here — the row exists so it can be
filled in via the inline editing from Task 7 immediately after creation; SPEC's own Contrôle N°
rules will flag it as ERREUR (not 10 digits) until it's filled in, which is the correct signal to
the operator, not a bug to prevent.

- [ ] **Step 2: Add the add-line button**

```typescript
// In ProvisionningTable.tsx, above the <table>:
import { ajouterLigneAction } from "./actions";

function AjouterLigneMenu({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const ajouter = (type: "numero" | "equipement" | "complete") => {
    startTransition(async () => {
      await ajouterLigneAction(clientId, type);
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={isPending}>+ Ajouter</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => ajouter("numero")}>Numéro seul</DropdownMenuItem>
        <DropdownMenuItem onClick={() => ajouter("equipement")}>Équipement seul</DropdownMenuItem>
        <DropdownMenuItem onClick={() => ajouter("complete")}>Ligne complète</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Render `<AjouterLigneMenu clientId={...} />` inside each client group header row (the
`<tr key={`groupe-${raisonSociale}`}>` block from Task 6), passing that group's `clientId` (available
on any `ProvisionningLigne` in `lignesDuClient`).

- [ ] **Step 3: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add app/provisionning
git commit -m "feat: add row-add to Provisionning grid"
```

---

## Task 11: Bulk actions

**Files:**
- Modify: `app/provisionning/actions.ts` (add `actionMasseAction`)
- Modify: `app/provisionning/ProvisionningTable.tsx` (add row selection, action bar,
  `AlertDialog` confirmation)

**Interfaces:**
- Consumes: `prisma`, `auth` (already imported).
- Produces: `actionMasseAction(numeroIds: string[], action: { type: "hebergeurCible"; valeur: string } | { type: "basculeFaite"; date: string } | { type: "exclureExport"; valeur: boolean }): Promise<{ success: boolean; count?: number; error?: string }>`.

- [ ] **Step 1: Add the Server Action**

```typescript
// app/provisionning/actions.ts (append)
type ActionMasse =
  | { type: "hebergeurCible"; valeur: string }
  | { type: "basculeFaite"; date: string }
  | { type: "exclureExport"; valeur: boolean };

export async function actionMasseAction(
  numeroIds: string[],
  action: ActionMasse
): Promise<{ success: boolean; count?: number; error?: string }> {
  const session = await auth();
  if (!session) {
    return { success: false, error: "Non authentifié." };
  }
  if (numeroIds.length === 0) {
    return { success: false, error: "Aucune ligne sélectionnée." };
  }

  try {
    if (action.type === "hebergeurCible") {
      const numeros = await prisma.numero.findMany({
        where: { id: { in: numeroIds } },
        select: { clientId: true },
      });
      const clientIds = [...new Set(numeros.map((n) => n.clientId))];
      await prisma.client.updateMany({
        where: { id: { in: clientIds } },
        data: { hebergeurCible: action.valeur },
      });
      return { success: true, count: clientIds.length };
    }

    if (action.type === "basculeFaite") {
      const result = await prisma.numero.updateMany({
        where: { id: { in: numeroIds } },
        data: { statutBascule: "Fait", dateBascule: new Date(action.date) },
      });
      revalidatePath("/");
      return { success: true, count: result.count };
    }

    const result = await prisma.numero.updateMany({
      where: { id: { in: numeroIds } },
      data: { exclureExport: action.valeur },
    });
    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue." };
  }
}
```

`hebergeurCible` is a `Client` field (SPEC §2), not a `Numero` field — a bulk action on a
selection of numéro rows applying "hébergeur cible" therefore updates the client(s) those
numéros belong to, not the numéro rows themselves. This mirrors the same distinction already
made in the design doc between client-level and numéro-level fields.

- [ ] **Step 2: Add selection state and the action bar**

```typescript
// In ProvisionningTable.tsx
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { actionMasseAction } from "./actions";

function BarreActionsMasse({ selection }: { selection: string[] }) {
  const [isPending, startTransition] = useTransition();
  if (selection.length === 0) return null;

  const executer = (action: Parameters<typeof actionMasseAction>[1]) => {
    startTransition(async () => {
      await actionMasseAction(selection, action);
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem", background: "#eef" }}>
      <span>{selection.length} ligne(s) sélectionnée(s)</span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button disabled={isPending}>Passer à Fait</button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la bascule</AlertDialogTitle>
            <AlertDialogDescription>
              Passer {selection.length} numéro(s) à "Fait" avec la date d'aujourd'hui ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                executer({ type: "basculeFaite", date: new Date().toISOString() })
              }
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button disabled={isPending}>Exclure de l'export</button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'exclusion</AlertDialogTitle>
            <AlertDialogDescription>
              Exclure {selection.length} numéro(s) de l'export ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executer({ type: "exclureExport", valeur: true })}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

Add selection state to `ProvisionningTable` itself:

```typescript
// Inside export function ProvisionningTable
const [selection, setSelection] = useState<string[]>([]);
const basculerSelection = (numeroId: string) => {
  setSelection((prev) =>
    prev.includes(numeroId) ? prev.filter((id) => id !== numeroId) : [...prev, numeroId]
  );
};
```

Add a checkbox column (first column) and render `<BarreActionsMasse selection={selection} />`
above the `<table>`:

```typescript
{
  id: "selection",
  header: "",
  cell: ({ row }) => (
    <Checkbox
      checked={selection.includes(row.original.numeroId)}
      onCheckedChange={() => basculerSelection(row.original.numeroId)}
    />
  ),
},
```

The module-level `columns` constant from Task 6 can't close over `selection`/`basculerSelection`
(component state), so turn it into a function and call it inside the component:

```typescript
// Replace `const columns: ColumnDef<ProvisionningLigne>[] = [...]` with:
function buildColumns(
  selection: string[],
  basculerSelection: (numeroId: string) => void
): ColumnDef<ProvisionningLigne>[] {
  return [
    {
      id: "selection",
      header: "",
      cell: ({ row }) => (
        <Checkbox
          checked={selection.includes(row.original.numeroId)}
          onCheckedChange={() => basculerSelection(row.original.numeroId)}
        />
      ),
    },
    { header: "Client (raison sociale)", accessorKey: "clientRaisonSociale" },
    { header: "Numéro à porter", accessorKey: "numeroBrut" },
    { header: "Numéro court", accessorFn: (row) => row.numerosCourts.join("/") },
    { header: "Contrôle N°", id: "controle", cell: ({ row }) => <ControleCell ligne={row.original} /> },
    { header: "Equipement", accessorKey: "equipementLibelle" },
    { header: "Adresse MAC équipement", accessorKey: "equipementMacBrut" },
    { header: "Utilisateur", accessorKey: "utilisateurNom" },
    { header: "Hébergeur source", accessorKey: "hebergeurSource" },
    { header: "Hébergeur cible", accessorKey: "hebergeurCible" },
    {
      header: "Bascule des numéros",
      id: "statutBascule",
      cell: ({ row }) => (
        <EditableCell
          numeroId={row.original.numeroId}
          champ="statutBascule"
          valeurInitiale={row.original.statutBascule}
        />
      ),
    },
    {
      header: "Date bascule",
      accessorFn: (row) => (row.dateBascule ? row.dateBascule.toISOString().slice(0, 10) : ""),
    },
    {
      header: "Commentaires",
      id: "commentaire",
      cell: ({ row }) => (
        <EditableCell
          numeroId={row.original.numeroId}
          champ="commentaire"
          valeurInitiale={row.original.commentaire ?? ""}
        />
      ),
    },
  ];
}
```

This consolidates the column list as it stands after Tasks 7 and 8's edits (the `statutBascule`/
`commentaire` editable cells, the `controle` cell using `ControleCell`) plus the new selection
column — replace the Task 6 `columns` constant and any later inline edits to it with this single
function. Inside `ProvisionningTable`, replace the `columns` reference passed to `useReactTable`
with `useMemo(() => buildColumns(selection, basculerSelection), [selection])`.

- [ ] **Step 3: Verify it compiles and builds**

```bash
bunx tsc --noEmit
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add app/provisionning
git commit -m "feat: add bulk actions to Provisionning grid"
```

---

## Task 12: Run the seed and verify against the real app

This task touches real infrastructure: runs the seed against the production database and deploys.
Confirm with the user before running — this is the point where a real login becomes possible.

**Files:** none (infra + manual verification)

- [ ] **Step 1: Run the full local test suite**

```bash
bun test
```

Expected: all tests from Task 4 (8 tests) plus the existing suite from prior plans still pass.

- [ ] **Step 2: Get a fresh database connection and run the seed**

```bash
cd /home/dev/Developpement/Projet/Everlink
bunx @prisma/cli@latest database connection create "Primary database" --name everlink-seed --project proj_cms4grybr13xb06f3x712e3u0
```

Capture the printed connection string, then:

```bash
export DATABASE_URL="<value printed above>"
bunx prisma db seed
```

Expected: prints "Seed complete." — creates the ADMIN account, `ListeValeur` rows, and
`ModeleEquipement` catalog. Note the login is `admin@everlink.local` / `changeme` — flag this to
the user as a password to change immediately after first login (there's no "change password" UI
yet, so this may need a direct database update or a follow-up task).

- [ ] **Step 3: Deploy**

```bash
bunx @prisma/cli@latest app deploy --project proj_cms4grybr13xb06f3x712e3u0 --region eu-west-3 --branch main --prod --yes
```

- [ ] **Step 4: Verify login and the Provisionning page live**

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://m1c0fnkdysq710fd20ol73yh.cdg.prisma.build/
```

Expected: a redirect (307/308) to `/login`, since the proxy now protects `/`. Report this to the
user and ask them to log in through the browser with the seeded credentials to confirm the
Provisionning grid renders (empty — the reprise feature, not part of this plan, is what will
populate it with real rows; the "Ajouter" button from Task 10 can also add a test row manually).

- [ ] **Step 5: Report**

Summarize what was verified (real command output, not just "it worked") back to the user,
including the reminder to change the seeded ADMIN password.

---

## Self-Review Notes

- **Spec coverage:** SPEC §3.1's every listed requirement has a task: grid+grouping (Task 6),
  inline edit with optimistic save/rollback (Task 7), Contrôle N° read-only + force-OK (Tasks 5,
  8), filters + global search (Task 9), three add-line variants (Task 10), bulk actions with
  confirmation (Task 11). SPEC §5's five Contrôle N° rules are all in Task 4's tests. Explicitly
  out of scope items (coller Excel, other 6 pages, Suivi client, recalcul screen) are named in
  Global Constraints, not silently dropped.
- **No placeholders:** every step has literal code. The one deliberately-simplified interaction
  (`window.prompt` for the force-OK motif in Task 8) is called out as an accepted simplification
  with a named follow-up, not a TBD.
- **Type consistency:** `ProvisionningLigne` (Task 5) is imported identically by Task 6's page and
  table component, and its fields (`numeroId`, `clientId`, `controleNiveau`, etc.) are referenced
  identically in Tasks 7, 8, 10, 11's cell/action code. `evaluerControle`'s signature (Task 4) is
  called identically in Task 5's repository.
- **Known gap, flagged not hidden:** the seeded ADMIN password (`changeme`) has no in-app way to
  change yet — Task 12 explicitly tells whoever runs it to flag this to the user.
