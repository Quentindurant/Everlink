# Scaffold + Prisma Compute deploy — design

Date: 2026-07-28

## Contexte

Repo contient seulement `CLAUDE.md`, `SPEC.md`, `prisma/schema.prisma`. Aucune app Next.js
scaffoldée. Le déploiement demandé cible Prisma Compute (`bunx @prisma/cli app deploy`), alors
que SPEC.md §1 documentait jusqu'ici un déploiement VPS + Docker/docker-compose. Décision:
Prisma Compute devient la cible réelle, SPEC.md est mis à jour en conséquence.

Portée choisie: squelette minimal suffisant pour un build et un déploiement réussis. Les pages
et fonctionnalités métier de SPEC.md §3-9 (Provisionning, imports SDA/MAC/Monday, exports,
synchronisation Google Sheets) sont hors scope, traitées dans un travail ultérieur séparé.

## Scaffold

- `create-next-app`: App Router, TypeScript, Tailwind, ESLint, pas de `src/` (racine du repo,
  cohérent avec `lib/domain/` et `lib/repositories/` déjà prévus dans CLAUDE.md).
- `shadcn/ui`: init sans composants ajoutés, ajout à la demande plus tard.
- `lib/prisma.ts`: client Prisma singleton, pointe sur `prisma/schema.prisma` existant, non modifié.
- `lib/auth.ts`: config Auth.js, provider credentials câblé sur `UtilisateurApp`, aucune page
  protégée pour l'instant.
- `app/page.tsx`: une page, statut santé app + connexion DB.
- `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
  `GOOGLE_SHEET_ID` (placeholders pour les vars non encore utilisées, alignés sur SPEC.md §1).
- Pas de logique métier, pas de tests: rien à tester dans un squelette.

## SPEC.md §1 — mise à jour

Remplacer le bloc Docker/VPS/compose par Prisma Compute:
- Déploiement via `bunx @prisma/cli@latest app deploy --project proj_cms4grybr13xb06f3x712e3u0`.
- Nom d'affichage projet: "Everlink". Région: `eu-west-3`.
- Variables d'environnement posées via prisma-cli, pas de `.env` committé.
- Migrations via `prisma migrate deploy`, jamais `db push` en production (invariant inchangé).
- Reste de la stack (Next.js/TS/Prisma/Tailwind/shadcn/TanStack Table) inchangé.

## Flux de déploiement

1. `bunx @prisma/cli@latest auth login` — interactif, étape navigateur faite par l'utilisateur.
2. `bunx @prisma/cli@latest app deploy --project proj_cms4grybr13xb06f3x712e3u0` depuis la racine
   du repo — crée l'app Compute et le premier déploiement.
3. Câbler `DATABASE_URL` sur la base primaire du projet.
4. `prisma migrate deploy` contre cette base.
5. Déploiement sur la branche main.

## Hors scope

Pages métier, imports, exports, synchronisation Google Sheets, cron sync — traités dans un
travail ultérieur séparé, une fois le pipeline de déploiement prouvé.
