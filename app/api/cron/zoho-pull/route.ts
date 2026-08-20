// ALIAS HISTORIQUE — la synchronisation Zoho Sheet est remplacée par le tableau de suivi
// maison. Cette URL (/api/cron/zoho-pull) est conservée pour ne pas casser la ligne cron
// déployée sur le serveur : elle sert exactement le même handler que /api/cron/suivi-pull
// (POST protégé par le header X-Cron-Secret, appelle runSuiviPull).
// À terme, faire pointer le cron sur /api/cron/suivi-pull puis supprimer ce fichier.
export { POST } from "../suivi-pull/route";

// Next exige une déclaration littérale (pas de réexport) pour la config de segment.
export const dynamic = "force-dynamic";
