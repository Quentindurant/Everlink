#!/usr/bin/env bash
# Applique les migrations Prisma + le seed via psql, depuis le VPS.
#
# Pourquoi psql et pas `prisma migrate deploy` : la base Prisma Postgres se connecte avec une
# chaîne `postgres://<id>:sk_...@db.prisma.io` que le CLI Prisma refuse (P1013), mais que psql
# et le driver pg de l'app acceptent.
#
# HYPOTHÈSE : migrations ADDITIVES (ADD COLUMN, CREATE TABLE, CREATE INDEX...). Une migration
# rejouée par erreur échoue en "already exists" (toléré). Une migration destructive (DROP,
# RENAME) doit être appliquée à la main — ne pas compter sur ce script pour ça.
set -uo pipefail

URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
if [ -z "${URL:-}" ]; then
  echo "DATABASE_URL absente de .env" >&2
  exit 1
fi

# Table de suivi des migrations déjà passées par ce script (indépendante de _prisma_migrations,
# qu'on ne peut pas alimenter proprement sans le CLI).
psql "$URL" -v ON_ERROR_STOP=1 -q -c \
  'CREATE TABLE IF NOT EXISTS "_migrations_appliquees" (name text PRIMARY KEY, applied_at timestamptz DEFAULT now());'

for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  sql="${dir}migration.sql"
  [ -f "$sql" ] || continue

  applied="$(psql "$URL" -tAq -c "SELECT 1 FROM \"_migrations_appliquees\" WHERE name = '$name'")"
  if [ "$applied" = "1" ]; then
    continue
  fi

  echo "→ migration $name"
  # ON_ERROR_STOP=off : au premier passage, les migrations déjà présentes dans la base (baseline
  # appliquée avant ce script) rejouent leurs CREATE/ALTER qui échouent en "already exists" sans
  # bloquer. Les objets réellement manquants, eux, sont créés.
  psql "$URL" -v ON_ERROR_STOP=off -q -f "$sql"
  psql "$URL" -q -c "INSERT INTO \"_migrations_appliquees\"(name) VALUES ('$name') ON CONFLICT DO NOTHING"
done

# Seed idempotent (étapes de suivi, étapes de migration, modèles de mail, catalogue). N'écrase
# rien d'existant. Nécessite SEED_ADMIN_PASSWORD pour le compte admin initial.
SEED_ADMIN_PASSWORD="$(grep -E '^SEED_ADMIN_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"')"
if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "→ seed"
  DATABASE_URL="$URL" SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" npx tsx prisma/seed.ts
else
  echo "SEED_ADMIN_PASSWORD absente : seed sauté"
fi

echo "migrations + seed OK"
