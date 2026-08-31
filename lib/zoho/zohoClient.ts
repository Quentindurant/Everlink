// ⚠️ DÉPRÉCIÉ (décision « Notre tableau seulement ») : l'app ne lit ni n'écrit plus dans le
// Zoho Sheet. Le tableau de suivi maison (lib/suivi/suiviClient) est l'unique cible.
// Ce module est conservé le temps de la transition (diagnostic scripts/zoho-verifier.ts,
// éventuels usages Zoho CRM futurs) — ne pas ajouter de nouvel appelant.
//
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
/** @deprecated Remplacé par lireAffectationsSuivi (lib/suivi/vueSuivi). Plus aucun appelant. */
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

export interface LigneZoho {
  client: string;
  dpt: string;
  date: string;
  heure: string;
  tech: string;
  nomTech: string;
  nomCp: string;
  installation: string;
  commentaires: string;
}

let cacheLignes: { at: number; onglet: string; data: LigneZoho[] } | null = null;
const CACHE_LIGNES_MS = 15_000;

// Lit les lignes de l'onglet du mois pour la vue live (read-only). Colonnes utiles seulement.
/** @deprecated Remplacé par lireVueSuivi (lib/suivi/vueSuivi). Seul scripts/zoho-verifier.ts l'utilise encore (diagnostic legacy). */
export async function lireLignesSheet(): Promise<{ onglet: string; lignes: LigneZoho[] }> {
  const c = zohoConfig();
  const onglet = c.worksheet as string;
  if (!c.configure) return { onglet, lignes: [] };
  if (cacheLignes && cacheLignes.onglet === onglet && Date.now() - cacheLignes.at < CACHE_LIGNES_MS) {
    return { onglet, lignes: cacheLignes.data };
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
    const S = (v: unknown) => (v == null ? "" : String(v));
    const lignes: LigneZoho[] = (data.records ?? [])
      // Ne garder que les dossiers gérés par Everlink (colonne PARTE).
      .filter((r) => S(r["PARTE"]).trim().toUpperCase() === "EVERLINK")
      .map((r) => ({
        client: S(r["CLIENT"]),
        dpt: S(r["DPT"]),
        date: S(r["DATE"]),
        heure: S(r["HEURE "] ?? r["HEURE"]),
        tech: S(r["TECH"]),
        nomTech: S(r["NOM TECH"]),
        nomCp: S(r["NOM CP"]),
        installation: S(r["INSTALLATION"]),
        commentaires: S(r["PORTA ET COMMENTAIRES IMPORTANT "] ?? r["PORTA ET COMMENTAIRES IMPORTANT"]),
      }));
    cacheLignes = { at: Date.now(), onglet, data: lignes };
    return { onglet, lignes };
  } catch {
    return { onglet, lignes: [] };
  }
}

// Ajoute une ligne au tableau (l'onglet est traité comme une table dont la 1re ligne porte les
// noms de colonnes). `record` est indexé par nom de colonne.
/** @deprecated Remplacé par creerLigne + patcherLigne (lib/suivi/suiviClient). Plus aucun appelant. */
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
