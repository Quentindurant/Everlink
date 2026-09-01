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

# Fréquences choisies en fonction du coût : la base est facturée à l'opération (quota
# mensuel), et chaque passage de cron en consomme quelques-unes.
#   - tableau de suivi → app : CHAQUE MINUTE. C'est le plus fin que permette cron, et le
#     poste reste modeste (~5 opérations par passage). Descendre plus bas demanderait un
#     autre mécanisme et ferait exploser le quota : à 5 secondes, on dépasserait 2,5 fois
#     le quota mensuel à lui seul.
#   - colis et délivrabilité des mails : toutes les 2 h, ces états bougent lentement.
#   - alerte prestataires : deux fois par jour, l'envoi est idempotent sur 20 h.
LINE_TRACKING="0 */2 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/tracking-sync >/dev/null 2>&1 ${TAG}"
LINE_ZOHO="* * * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/zoho-pull >/dev/null 2>&1 ${TAG}"
LINE_ALERTE="15 8,14 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/alerte-prestataires >/dev/null 2>&1 ${TAG}"
LINE_MAIL="45 */2 * * * curl -fsS -X POST -H \"X-Cron-Secret: ${SECRET}\" http://localhost:${PORT}/api/cron/mail-suivi >/dev/null 2>&1 ${TAG}"

# Réécrit le crontab : toutes les lignes sauf les nôtres, plus les nôtres à jour. Le secret
# n'est jamais imprimé (pas d'echo des lignes) pour ne pas fuiter dans les logs du déploiement.
{ crontab -l 2>/dev/null | grep -vF "$TAG" || true; printf '%s\n' "$LINE_TRACKING" "$LINE_ZOHO" "$LINE_MAIL" "$LINE_ALERTE"; } | crontab -
echo "install-crons: crons tracking-sync, zoho-pull, mail-suivi et alerte-prestataires installés (toutes les 2h, port ${PORT})."
