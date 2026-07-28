# Scaffold + Prisma Compute Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a minimal Next.js skeleton wired to the existing `prisma/schema.prisma`, then deploy it to Prisma Compute (project `proj_cms4grybr13xb06f3x712e3u0`, region `eu-west-3`), with the project's primary database migrated and wired via `DATABASE_URL`, live on the `main` branch.

**Architecture:** Next.js App Router + TypeScript app at repo root, Prisma Client against the existing schema, Auth.js credentials provider stub (no protected pages yet), one health-check page. Deployed with `@prisma/cli` (`bunx @prisma/cli@latest`), which has no `migrate` command in the beta — migrations run separately with the standard Prisma ORM CLI against the Compute Postgres database.

**Tech Stack:** Next.js (App Router, TS, Tailwind, ESLint), Prisma ORM + Prisma Client, Auth.js (`next-auth`) credentials provider, bcryptjs, shadcn/ui, Bun as package manager and deploy runtime, `@prisma/cli` for Compute.

## Global Constraints

- No `prisma db push` outside local dev; migrations are versioned files, committed. (SPEC.md §1, CLAUDE.md)
- `DATABASE_URL` never committed; `.env.example` documents required vars only. (SPEC.md §1)
- French UI labels when UI is added later — not relevant to this skeleton (no business pages yet).
- Deploy target is Prisma Compute (this plan updates SPEC.md §1 away from the old VPS/Docker text — see `docs/superpowers/specs/2026-07-28-prisma-compute-deploy-design.md`).
- Migrations do not run automatically on Compute deploy — run them explicitly against the right database before/at deploy time. (Prisma Compute docs: "Don't assume migrations run automatically on deploy.")
- `@prisma/cli` beta has no `schema`/`migrate` command group — use plain `prisma` (ORM CLI) for schema/migrate work, `prisma-cli` (`@prisma/cli`) only for `auth`, `project`, `database`, `app`, `git`, `branch`.

---

## Task 1: Scaffold Next.js app without clobbering existing files

The repo root already has `CLAUDE.md`, `SPEC.md`, `prisma/schema.prisma`, `docs/`, `.git`, `.claude`, `.agents`, `skills-lock.json`, `README.md`. `create-next-app` scaffolds into an empty directory, so scaffold into a temp dir and merge instead of fighting its conflict checks.

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `next.config.ts`, `tsconfig.json`, `package.json`, `.eslintrc`/`eslint.config.*`, `postcss.config.*`, `.gitignore` (merged from generated + existing)
- Modify: `README.md` (keep existing `# Everlink` heading, append generated content below it)

**Interfaces:**
- Produces: a `package.json` with `dev`/`build`/`start`/`lint` scripts that every later task's `bun run <script>` calls rely on.

- [ ] **Step 1: Check bun is installed**

```bash
bun --version
```

If missing, install it:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then re-open the shell / source the profile it prints, and re-check `bun --version`.

- [ ] **Step 2: Scaffold into a temp directory**

```bash
tmp=$(mktemp -d)
bunx create-next-app@latest "$tmp/everlink" \
  --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-bun --no-react-compiler --turbopack < /dev/null
```

If this prompts instead of running non-interactively (no TTY), it will error instead of hanging because of `< /dev/null` — read the error, add the missing flag, retry.

- [ ] **Step 3: Merge generated files into repo root**

```bash
cd "$tmp/everlink"
rsync -a --exclude='.git' --exclude='README.md' ./ /home/dev/Developpement/Projet/Everlink/
cd /home/dev/Developpement/Projet/Everlink
```

Manually merge `README.md`: keep the existing `# Everlink` line, append the generated boilerplate content below it (Read both versions first — the generated one was excluded from rsync, read it from `$tmp/everlink/README.md`).

- [ ] **Step 4: Verify the scaffold builds**

```bash
bun install
bun run build
```

Expected: build succeeds (it will fail on missing `DATABASE_URL` only if a page imports the Prisma client at build time — this skeleton's only page doesn't yet, so it should pass with no env vars set).

- [ ] **Step 5: Set standalone output for Compute**

Edit `next.config.ts`, add `output: "standalone"` to the config object (required by Prisma Compute for Next.js apps).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (App Router, TS, Tailwind)"
```

---

## Task 2: Wire Prisma Client to the existing schema

**Decision (2026-07-28, after fix-round 1 on this task):** Prisma 7 is current as of this plan and Prisma Compute's docs are written for it — use Prisma 7, not an older major picked to avoid touching `schema.prisma`. Prisma 7 requires removing the `url` field from the schema's `datasource` block (validation error P1012, confirmed against real `prisma generate` output) — connection URL moves to a new `prisma.config.ts` instead. `prisma/schema.prisma` is no longer fully off-limits for this task: the `datasource` block's `url` line may be removed. Every other model/field/enum in the file stays untouched.

**Files:**
- Create: `lib/prisma.ts`
- Create: `prisma.config.ts`
- Modify: `prisma/schema.prisma` (datasource block only: remove the `url` line, keep `provider = "postgresql"`)
- Modify: `package.json` (add `@prisma/client`, `prisma` devDependency, both major version 7)
- Modify: `.gitignore` (ensure `.env` is ignored — create-next-app already ignores `.env*.local`, add plain `.env`)

**Interfaces:**
- Produces: `prisma` — singleton `PrismaClient` instance, imported as `import { prisma } from "@/lib/prisma"` by every later task that touches the database.

- [ ] **Step 1: Install Prisma 7**

```bash
bun add -d prisma@7
bun add @prisma/client@7
```

- [ ] **Step 2: Move the connection URL out of schema.prisma**

Edit `prisma/schema.prisma`'s `datasource` block: delete the `url = env("DATABASE_URL")` line, keep `provider = "postgresql"`. Do not touch anything else in the file (models, enums, generator block all stay as-is — `prisma-client-js` is deprecated in v7 but still supported, no need to migrate to the new `prisma-client` provider for this task).

Create `prisma.config.ts` at the repo root:

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- [ ] **Step 3: Generate the client from the updated schema**

```bash
bunx prisma generate
```

Expected: succeeds, prints generated client location. If it errors on a missing `DATABASE_URL`, that's expected when no `.env` exists yet — `prisma generate` doesn't need a reachable database, only a resolvable config; if it hard-fails instead of just warning, set a placeholder (`DATABASE_URL=postgresql://placeholder` in a local untracked `.env`) for this step only.

- [ ] **Step 4: Write the singleton client**

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Verify it compiles**

```bash
bunx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/prisma.ts prisma.config.ts prisma/schema.prisma package.json bun.lock .gitignore
git commit -m "feat: add Prisma client singleton, upgrade to Prisma 7"
```

---

## Task 3: Auth.js credentials provider stub

Wires authentication config against `UtilisateurApp` (from `prisma/schema.prisma`: `id`, `email`, `nom`, `motDePasse`, `role`, `actif`). No login page or route protection yet — that's a later, separate piece of work once real pages exist.

**Decision (2026-07-28, verified against current authjs.dev docs before dispatch):** Auth.js's own docs now lead with "The Auth.js project is now part of Better Auth" and a "Migrate to Better Auth" link — the project has folded into Better Auth org-wise. It's still published and documented (`next-auth@beta` installs and works), and SPEC.md §1 explicitly mandates "Auth: Auth.js provider credentials" — that's a standing project decision, not something this task re-opens. Staying on Auth.js. Flag the Better Auth situation to the human partner as a heads-up (not a blocker) once this task lands. Two other things the docs' current canonical example does differently from an earlier draft of this plan: (1) install tag is `next-auth@beta`, not bare `next-auth`; (2) the canonical file layout is a single `auth.ts` at the repo root that calls `NextAuth({...})` once and exports `{ handlers, signIn, signOut, auth }`, with the route handler just re-exporting `handlers` — not a separate `lib/auth.ts` config object plus a second `NextAuth()` call in the route file. Follow the docs' layout.

**Files:**
- Create: `auth.ts` (repo root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Modify: `package.json` (add `next-auth@beta`, `bcryptjs`, `@types/bcryptjs`)

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts` (Task 2)
- Produces: `auth`, `signIn`, `signOut`, `handlers` (named exports from `auth.ts` at repo root) — later protected pages import `auth` to read the session; the route handler imports `handlers`.

- [ ] **Step 1: Install dependencies**

```bash
bun add next-auth@beta bcryptjs
bun add -d @types/bcryptjs
```

- [ ] **Step 2: Write the auth config**

```typescript
// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const utilisateur = await prisma.utilisateurApp.findUnique({
          where: { email },
        });
        if (!utilisateur || !utilisateur.actif) return null;

        const valid = await bcrypt.compare(password, utilisateur.motDePasse);
        if (!valid) return null;

        return {
          id: utilisateur.id,
          email: utilisateur.email,
          name: utilisateur.nom,
          role: utilisateur.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});
```

- [ ] **Step 3: Wire the route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Verify it compiles**

```bash
bunx tsc --noEmit
```

Expected: no type errors. (`/login` route not existing yet is fine — `pages.signIn` is just a config value, not a build-time import.)

- [ ] **Step 5: Commit**

```bash
git add auth.ts app/api/auth package.json bun.lock
git commit -m "feat: add Auth.js credentials provider stub"
```

---

## Task 4: Health-check page and .env.example

**Files:**
- Modify: `app/page.tsx` (replace generated boilerplate)
- Create: `.env.example`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts` (Task 2)

- [ ] **Step 1: Write the health-check page**

```typescript
// app/page.tsx
import { prisma } from "@/lib/prisma";

export default async function HealthPage() {
  let dbStatus: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Everlink</h1>
      <p>App: ok</p>
      <p>Database: {dbStatus}</p>
    </main>
  );
}
```

- [ ] **Step 2: Write `.env.example`**

```bash
# prisma/schema.prisma datasource
DATABASE_URL=

# Auth.js
AUTH_SECRET=

# Cron endpoint (POST /api/cron/sheets-sync), not yet implemented
CRON_SECRET=

# Google Sheets sync, not yet implemented
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEET_ID=
```

- [ ] **Step 3: Verify build still succeeds without a real DATABASE_URL**

```bash
bun run build
```

Expected: build succeeds. `app/page.tsx` queries the DB at request time (it's a dynamic server component doing an async query), not at build time, so a missing `DATABASE_URL` at build time is fine — it would only fail at runtime, which is expected before the app is deployed and wired.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx .env.example
git commit -m "feat: add health-check page and .env.example"
```

---

## Task 5: Update SPEC.md §1 to Prisma Compute

**Files:**
- Modify: `SPEC.md` (§1 "Stack et déploiement", currently lines 23-43)

- [ ] **Step 1: Replace the Docker/VPS deployment paragraphs**

Replace the two bullets covering Docker/compose and scheduled tasks (currently):
```
- Docker: image applicative multi-stage (`node:lts-alpine`, `output: "standalone"`), `docker-compose.yml`
  avec les services `app`, `db` (postgres) et un volume nommé pour les données Postgres.
  Reverse proxy (Caddy ou Nginx) hors compose ou en service supplémentaire, au choix.
- Tâches planifiées: pas de conteneur worker. Endpoint `POST /api/cron/sheets-sync` protégé par un
  header `X-Cron-Secret`, appelé par la crontab du VPS.
```
with:
```
- Déploiement: Prisma Compute (`bunx @prisma/cli@latest app deploy`), projet `proj_cms4grybr13xb06f3x712e3u0`,
  nom d'affichage "Everlink", région `eu-west-3`. `output: "standalone"` dans `next.config.ts`.
  Variables d'environnement posées via `bunx @prisma/cli@latest project env add`, jamais de `.env` committé.
  Migrations: `bunx prisma migrate deploy` contre la base du projet, jamais automatique au déploiement.
- Tâches planifiées: pas de conteneur worker. Endpoint `POST /api/cron/sheets-sync` protégé par un
  header `X-Cron-Secret`, appelé par un scheduler externe (à définir — la crontab VPS n'existe plus
  avec Prisma Compute).
```

Leave the rest of §1 (Next.js/TS, PostgreSQL/Prisma, Tailwind/shadcn/TanStack, xlsx libs, Auth.js, env var list) unchanged — only the deployment mechanism changes.

- [ ] **Step 2: Re-read the section and confirm it reads consistently**

Read `SPEC.md` lines 23-43 back and confirm no leftover references to Docker/VPS/compose remain in §1, and no other section cross-references the removed text (grep for "Docker" and "VPS" across the file).

```bash
grep -n "Docker\|VPS\|compose" SPEC.md
```

Expected: no matches (or only the crontab caveat added above, if that wording is kept).

- [ ] **Step 3: Commit**

```bash
git add SPEC.md
git commit -m "docs: update SPEC.md deploy target to Prisma Compute"
```

---

## Task 6: Generate the initial migration offline

No local Postgres is available in this environment, and `prisma migrate dev` needs one (for its shadow database). Generate the migration SQL from the schema directly instead — this needs no database connection at all — then apply it with `migrate deploy` against the real database in Task 7.

**Files:**
- Create: `prisma/migrations/migration_lock.toml`
- Create: `prisma/migrations/<timestamp>_init/migration.sql`

- [ ] **Step 1: Generate the diff SQL**

```bash
bunx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/init.sql
```

Expected: exits 0, `/tmp/init.sql` contains `CREATE TABLE` statements for every model in `prisma/schema.prisma` (UtilisateurApp, Lot, etc.).

- [ ] **Step 2: Place it as a proper migration**

```bash
ts=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${ts}_init"
mv /tmp/init.sql "prisma/migrations/${ts}_init/migration.sql"
printf 'provider = "postgresql"\n' > prisma/migrations/migration_lock.toml
```

- [ ] **Step 3: Validate the schema and migration are consistent**

```bash
bunx prisma validate
```

Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations
git commit -m "feat: add initial Prisma migration"
```

---

## Task 7: Deploy to Prisma Compute

This task touches real infrastructure: it creates a live Compute app under a real project, runs migrations against a real database, and sets a production env var. Confirm with the user before running Steps 3 onward — Steps 1-2 are read-only checks.

**Files:** none (CLI-driven, no repo changes except `.gitignore`d `.prisma/local.json` and `prisma.compute.ts` if `app deploy` writes one)

- [ ] **Step 1: Confirm authentication**

```bash
bunx @prisma/cli@latest auth whoami
```

If not signed in, stop and ask the user to run `bunx @prisma/cli@latest auth login` themselves (opens a browser — needs a human).

- [ ] **Step 2: Confirm the project and find its primary database**

```bash
bunx @prisma/cli@latest project show --project proj_cms4grybr13xb06f3x712e3u0
bunx @prisma/cli@latest database list --project proj_cms4grybr13xb06f3x712e3u0
```

Confirm the project's display name is "Everlink" and region is `eu-west-3` (report a mismatch to the user rather than trying to change it — no rename command exists in the CLI reference). Note the database name from `database list` — this is "the project's primary database" the task refers to.

- [ ] **Step 3: Get a connection string for that database**

```bash
bunx @prisma/cli@latest database connection create <database-name-from-step-2> --name everlink-migrate
```

This prints a connection string once — capture it into a shell variable, don't paste it into any committed file:

```bash
export DATABASE_URL="<value printed above>"
```

- [ ] **Step 4: Run the migration against the real database**

```bash
bunx prisma migrate deploy
```

Expected: applies the `<timestamp>_init` migration from Task 6, prints "1 migration found... applied". Uses `$DATABASE_URL` from Step 3's export.

- [ ] **Step 5: Persist DATABASE_URL for the deployed app**

```bash
bunx @prisma/cli@latest project env add DATABASE_URL="$DATABASE_URL" --project proj_cms4grybr13xb06f3x712e3u0 --role production
```

- [ ] **Step 6: Deploy**

```bash
bunx @prisma/cli@latest app deploy \
  --project proj_cms4grybr13xb06f3x712e3u0 \
  --region eu-west-3 \
  --branch main
```

If this is not the project's first-ever production deploy, it will fail with `PROD_DEPLOY_REQUIRES_FLAG` — re-run with `--prod --yes` appended. Expected: prints a live URL; first deploy from this directory promotes to production automatically.

- [ ] **Step 7: Verify**

```bash
bunx @prisma/cli@latest app open
```

or capture the printed URL and:

```bash
curl -sf <printed-url>
```

Expected: HTTP 200, page shows "App: ok" and "Database: ok" (confirms both the app and the `DATABASE_URL` wiring from Step 5 work end to end).

- [ ] **Step 8: Commit any CLI-generated config**

```bash
git status
```

If `app deploy` wrote `prisma.compute.ts`, review it and commit:

```bash
git add prisma.compute.ts
git commit -m "chore: add Prisma Compute app configuration"
```

`.prisma/local.json` is gitignored by the CLI itself — don't force-add it.

---

## Self-Review Notes

- **Spec coverage:** design doc's five sections (Scaffold, SPEC.md update, Deploy flow, hors scope) all map to tasks 1-7 above; hors-scope items (Provisionning, imports, exports, Sheets sync) intentionally have no task.
- **No placeholders:** every step has literal commands/code; the one open unknown (whether `--prod --yes` is needed in Task 7 Step 6) is called out as a conditional retry, not a TBD.
- **Type consistency:** `prisma` (Task 2) is imported identically in Task 3 (`lib/auth.ts`) and Task 4 (`app/page.tsx`) as `import { prisma } from "@/lib/prisma"`.
