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

# Rafraîchit l'état des colis (La Poste/Chronopost) toutes les 2 heures, et synchronise le
# Zoho Sheet vers l'app (statut/planif des dossiers) toutes les 2 heures, décalé de 30 min.
LINE_TRACKING="0 */2 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/tracking-sync >/dev/null 2>&1 ${TAG}"
LINE_ZOHO="30 */2 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/zoho-pull >/dev/null 2>&1 ${TAG}"

# Réécrit le crontab : toutes les lignes sauf les nôtres, plus les nôtres à jour. Le secret
# n'est jamais imprimé (pas d'echo des lignes) pour ne pas fuiter dans les logs du déploiement.
{ crontab -l 2>/dev/null | grep -vF "$TAG" || true; printf '%s\n' "$LINE_TRACKING" "$LINE_ZOHO"; } | crontab -
echo "install-crons: crons tracking-sync et zoho-pull installés (toutes les 2h, port ${PORT})."
