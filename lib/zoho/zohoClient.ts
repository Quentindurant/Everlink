// Client Zoho Sheet (data center EU). Authentification OAuth via refresh token, ajout de ligne
// dans la feuille de suivi des commandes. Config en environnement (jamais de secret committé) :
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_SHEET_RESOURCE_ID (id du classeur, ex "36x6e...")
//   ZOHO_WORKSHEET (onglet cible, ex "AOUT 2026")
//
// Le refresh token est permanent; l'access token (~1h) est régénéré à chaque appel. Pas de cache
// pour rester simple: l'ajout de ligne est une action manuelle peu fréquente.

const ACCOUNTS = "https://accounts.zoho.eu";
const SHEET_API = "https://sheet.zoho.eu/api/v2";

const MOIS = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

// Nom de l'onglet du mois courant, ex "AOUT 2026". Sert de défaut quand ZOHO_WORKSHEET n'est
// pas fixé, pour suivre le découpage mensuel du classeur sans reconfigurer chaque mois.
export function ongletDuMois(d = new Date()): string {
  return `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function zohoConfig() {
  const {
    ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET,
    ZOHO_REFRESH_TOKEN,
    ZOHO_SHEET_RESOURCE_ID,
    ZOHO_WORKSHEET,
  } = process.env;
  return {
    clientId: ZOHO_CLIENT_ID,
    clientSecret: ZOHO_CLIENT_SECRET,
    refreshToken: ZOHO_REFRESH_TOKEN,
    resourceId: ZOHO_SHEET_RESOURCE_ID,
    // Onglet: valeur explicite si fournie, sinon l'onglet du mois courant (classeur mensuel).
    worksheet: ZOHO_WORKSHEET || ongletDuMois(),
    configure:
      !!ZOHO_CLIENT_ID &&
      !!ZOHO_CLIENT_SECRET &&
      !!ZOHO_REFRESH_TOKEN &&
      !!ZOHO_SHEET_RESOURCE_ID,
  };
}

async function accessToken(): Promise<string> {
  const c = zohoConfig();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: c.clientId as string,
    client_secret: c.clientSecret as string,
    refresh_token: c.refreshToken as string,
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token?${params.toString()}`, { method: "POST" });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Zoho OAuth: ${data.error ?? "pas d'access_token"}`);
  }
  return data.access_token;
}

// Cache mémoire des affectations lues (le process pm2 est unique). Évite un appel Zoho à chaque
// affichage de disponibilité.
let cacheAffectations: { at: number; onglet: string; data: { nomTech: string; date: string }[] } | null = null;
const CACHE_MS = 120_000;

// Lit les affectations (NOM TECH + DATE) de l'onglet du mois pour calculer la disponibilité.
// Renvoie [] si Zoho n'est pas configuré ou en cas d'erreur (la dispo retombe alors sur les
// seules affectations de l'app).
export async function lireAffectationsSheet(): Promise<{ nomTech: string; date: string }[]> {
  const c = zohoConfig();
  if (!c.configure) return [];
  const onglet = c.worksheet as string;
  if (cacheAffectations && cacheAffectations.onglet === onglet && Date.now() - cacheAffectations.at < CACHE_MS) {
    return cacheAffectations.data;
  }
  try {
    const token = await accessToken();
    const body = new URLSearchParams({
      method: "worksheet.records.fetch",
      worksheet_name: onglet,
      header_row: "1",
      count: "2000",
    });
    const res = await fetch(`${SHEET_API}/${c.resourceId}`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json()) as { records?: Record<string, unknown>[] };
    const out = (data.records ?? []).map((r) => ({
      nomTech: String(r["NOM TECH"] ?? ""),
      date: String(r["DATE"] ?? ""),
    }));
    cacheAffectations = { at: Date.now(), onglet, data: out };
    return out;
  } catch {
    return [];
  }
}

// Ajoute une ligne au tableau (l'onglet est traité comme une table dont la 1re ligne porte les
// noms de colonnes). `record` est indexé par nom de colonne.
export async function ajouterLigneSheet(
  record: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const c = zohoConfig();
  if (!c.configure) {
    return { success: false, error: "Zoho non configuré (variables ZOHO_* manquantes)." };
  }
  try {
    const token = await accessToken();
    const body = new URLSearchParams({
      method: "worksheet.records.add",
      worksheet_name: c.worksheet as string,
      header_row: "1",
      json_data: JSON.stringify([record]),
    });
    const res = await fetch(`${SHEET_API}/${c.resourceId}`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json()) as { status?: string; error?: unknown };
    if (data.status && data.status !== "success") {
      return { success: false, error: `Zoho Sheet: ${JSON.stringify(data.error ?? data)}` };
    }
    if (!res.ok) {
      return { success: false, error: `Zoho Sheet HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec Zoho." };
  }
}
