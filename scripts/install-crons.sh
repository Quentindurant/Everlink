#!/usr/bin/env bash
# Installe/rafraîchit les tâches cron gérées par Everlink sur le VPS, de façon idempotente.
# Seules les lignes marquées du tag ci-dessous sont réécrites : les autres entrées crontab
# (dont un éventuel sheets-sync configuré à la main) sont préservées telles quelles.
#
# Appelé par .github/workflows/deploy.yml après le démarrage pm2. Ne fait rien (sans échouer)
# si le .env ou CRON_SECRET est absent, pour ne jamais casser un déploiement.
set -eo pipefail

TAG="# everlink-managed"
ENV_FILE="${1:-.env}"
PORT="${2:-3005}"

if [ ! -f "$ENV_FILE" ]; then
  echo "install-crons: $ENV_FILE introuvable, crons non installés." >&2
  exit 0
fi

# Lit CRON_SECRET du .env et retire d'éventuels guillemets de bord. Le `|| true` évite que
# `set -e`/`pipefail` fasse échouer le script quand la variable est absente (grep sort en 1).
SECRET="$( { grep -E '^CRON_SECRET=' "$ENV_FILE" || true; } | head -n1 | cut -d= -f2-)"
SECRET="${SECRET%\"}"; SECRET="${SECRET#\"}"
SECRET="${SECRET%\'}"; SECRET="${SECRET#\'}"

if [ -z "$SECRET" ]; then
  echo "install-crons: CRON_SECRET absent de $ENV_FILE, crons non installés." >&2
  exit 0
fi

# Rafraîchit l'état des colis (La Poste/Chronopost) toutes les 2 heures.
LINE="0 */2 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/tracking-sync >/dev/null 2>&1 ${TAG}"

# Réécrit le crontab : toutes les lignes sauf les nôtres, plus la nôtre à jour. Le secret
# n'est jamais imprimé (pas d'echo de $LINE) pour ne pas fuiter dans les logs du déploiement.
{ crontab -l 2>/dev/null | grep -vF "$TAG" || true; printf '%s\n' "$LINE"; } | crontab -
echo "install-crons: cron tracking-sync installé (toutes les 2h, port ${PORT})."
