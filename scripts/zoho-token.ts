// Régénère le ZOHO_REFRESH_TOKEN à partir d'un code d'auto-client Zoho.
//
// Un refresh token Zoho est révoqué si la clé est régénérée ou si le compte dépasse une
// vingtaine de jetons actifs : la synchronisation du Sheet s'arrête alors silencieusement
// (l'API renvoie « invalid_code » et l'app lit zéro ligne). Ce script refait le jeton sans
// avoir à retrouver la procédure.
//
// Marche à suivre :
//   1. https://api-console.zoho.eu/  →  l'application « Self Client » du projet
//   2. Onglet « Generate Code »
//        Scope    : ZohoSheet.dataAPI.READ,ZohoSheet.dataAPI.UPDATE
//        Duration : 10 minutes   (le code est à usage unique et expire vite)
//   3. Copier le code, puis :
//        bun run scripts/zoho-token.ts <code>
//   4. Reporter la ligne ZOHO_REFRESH_TOKEN affichée dans le .env local ET celui du VPS,
//      puis `pm2 restart everlink` sur le VPS.
//
// Les identifiants sont lus dans le .env : rien n'est écrit, rien n'est affiché en clair
// à part le refresh token lui-même (qui est justement ce qu'on vient chercher).

import { readFileSync } from "node:fs";

const ACCOUNTS = "https://accounts.zoho.eu";

function lireEnv(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(".env", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage : bun run scripts/zoho-token.ts <code généré dans l'API console>");
    process.exit(1);
  }
  const env = lireEnv();
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET } = env;
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    console.error("ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET absents du .env.");
    process.exit(1);
  }

  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
  };

  if (!data.refresh_token) {
    console.error(`Échec : ${data.error ?? JSON.stringify(data)}`);
    console.error(
      data.error === "invalid_code"
        ? "Le code est expiré ou déjà utilisé — regénérez-en un (durée 10 min, usage unique)."
        : "Vérifiez le scope et que le code vient bien de la console .eu."
    );
    process.exit(1);
  }

  console.log("\nÀ coller dans le .env (local et VPS) :\n");
  console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}\n`);
  console.log("Puis vérifier la lecture du Sheet :  bun run scripts/zoho-verifier.ts");
}

main();
