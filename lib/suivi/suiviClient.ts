// Client HTTP du tableau de suivi maison (API NestJS, prod https://suivie.appgcd.fr) qui
// remplace le Zoho Sheet. Particularités du serveur (vérifiées dans TableauSuivieGcDev) :
//   - authentification par cookie httpOnly `token` UNIQUEMENT (le guard ne lit aucun
//     header Bearer) : POST /api/auth/login pose le cookie, on le rejoue ensuite à la main
//     (serveur → serveur), et on se reconnecte automatiquement sur 401 ;
//   - GET /api/rows?month=AAAA-MM, POST /api/rows {month}, PATCH /api/rows/:id
//     {expectedVersion, patch} ; un 409 VERSION_CONFLICT porte details.current (la ligne
//     relue) : on retente UNE fois avec la version relue, puis on abandonne proprement.
// Config en environnement (jamais de secret committé) :
//   SUIVI_API_URL, SUIVI_API_EMAIL, SUIVI_API_PASSWORD
import type { DonneesLigne, ValeurCellule } from "@/lib/domain/suivi/ligneSuivi";

/** Ligne du tableau telle que renvoyée par l'API (contrat RowDTO, champs utiles). */
export interface SuiviRow {
  id: string;
  month: string;
  position: number;
  data: DonneesLigne;
  version: number;
  archived: boolean;
}

interface ApiErreur {
  code?: string;
  message?: string;
  details?: { current?: SuiviRow; conflictKeys?: string[] };
}

export type ResultatPatch =
  | { success: true; row: SuiviRow }
  | { success: false; error: string; conflictKeys?: string[] };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface OptionsSuiviClient {
  baseUrl: string;
  email: string;
  password: string;
  /** Injecté par les tests ; fetch global sinon. */
  fetchImpl?: FetchLike;
  /** TTL du cache de lecture par mois (15 s par défaut, 0 = désactivé). */
  cacheMs?: number;
  /** Abandon des requêtes réseau après ce délai (15 s par défaut). */
  timeoutMs?: number;
}

export interface SuiviClient {
  lireLignesMois(mois: string): Promise<SuiviRow[]>;
  creerLigne(mois: string): Promise<SuiviRow>;
  patcherLigne(id: string, expectedVersion: number, patch: Record<string, ValeurCellule>): Promise<ResultatPatch>;
  /** Compensation du push en deux temps : efface une ligne créée puis non remplie. */
  supprimerLigne(id: string): Promise<void>;
}

/** "https://suivie.appgcd.fr/", ".../api", ".../api/" → "https://suivie.appgcd.fr". */
function normaliserBaseUrl(brut: string): string {
  return brut.replace(/\/+$/, "").replace(/\/api$/, "");
}

/** Extrait la valeur du cookie `token` d'une réponse de login. */
function extraireCookieToken(res: Response): string | null {
  const enTetes = res.headers as Headers & { getSetCookie?: () => string[] };
  const brut = enTetes.getSetCookie ? enTetes.getSetCookie().join("\n") : enTetes.get("set-cookie") ?? "";
  const m = brut.match(/(?:^|[\s;,])token=([^;,\s]+)/);
  return m ? m[1] : null;
}

async function messageErreur(res: Response, contexte: string): Promise<string> {
  try {
    const corps = (await res.json()) as ApiErreur;
    if (corps.message) return corps.message;
  } catch {
    // corps illisible : on retombe sur le statut HTTP
  }
  return `${contexte} (HTTP ${res.status})`;
}

export function creerSuiviClient(options: OptionsSuiviClient): SuiviClient {
  const base = normaliserBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 15_000;
  // Sans signal, un tableau injoignable fait pendre push/pull/cron jusqu'au timeout de la
  // plateforme : on préfère échouer vite et laisser les try/catch amont rendre la main.
  const f: FetchLike =
    options.fetchImpl ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }));
  const cacheMs = options.cacheMs ?? 15_000;

  // Session partagée par toutes les méthodes du client (process pm2 unique).
  let cookieSession: string | null = null;
  const cacheParMois = new Map<string, { at: number; rows: SuiviRow[] }>();

  async function connecter(): Promise<void> {
    const res = await f(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: options.email, password: options.password }),
    });
    if (!res.ok) {
      throw new Error(`Connexion au tableau de suivi refusée : ${await messageErreur(res, "login")}`);
    }
    const jeton = extraireCookieToken(res);
    if (!jeton) {
      throw new Error("Connexion au tableau de suivi : cookie de session absent de la réponse.");
    }
    cookieSession = jeton;
  }

  /** Requête authentifiée ; sur 401 (session expirée), re-login puis UNE relance. */
  async function requete(chemin: string, init?: RequestInit): Promise<Response> {
    if (!cookieSession) await connecter();
    const avecCookie = (): RequestInit => ({
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), Cookie: `token=${cookieSession}` },
    });
    let res = await f(`${base}${chemin}`, avecCookie());
    if (res.status === 401) {
      cookieSession = null;
      await connecter();
      res = await f(`${base}${chemin}`, avecCookie());
    }
    return res;
  }

  async function lireLignesMois(mois: string): Promise<SuiviRow[]> {
    const enCache = cacheParMois.get(mois);
    if (cacheMs > 0 && enCache && Date.now() - enCache.at < cacheMs) return enCache.rows;
    const res = await requete(`/api/rows?month=${encodeURIComponent(mois)}`);
    if (!res.ok) {
      throw new Error(`Lecture du tableau de suivi impossible : ${await messageErreur(res, "GET /rows")}`);
    }
    const rows = (await res.json()) as SuiviRow[];
    cacheParMois.set(mois, { at: Date.now(), rows });
    return rows;
  }

  async function creerLigne(mois: string): Promise<SuiviRow> {
    const res = await requete(`/api/rows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: mois }),
    });
    if (!res.ok) {
      throw new Error(`Création de ligne refusée : ${await messageErreur(res, "POST /rows")}`);
    }
    cacheParMois.delete(mois);
    return (await res.json()) as SuiviRow;
  }

  async function patcherUneFois(
    id: string,
    expectedVersion: number,
    patch: Record<string, ValeurCellule>
  ): Promise<Response> {
    return requete(`/api/rows/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion, patch }),
    });
  }

  async function patcherLigne(
    id: string,
    expectedVersion: number,
    patch: Record<string, ValeurCellule>
  ): Promise<ResultatPatch> {
    let res = await patcherUneFois(id, expectedVersion, patch);

    // Conflit de version : le corps porte la ligne relue (details.current) ; on retente
    // UNE fois avec cette version — nos valeurs gagnent —, puis on abandonne avec les
    // clés en conflit pour laisser la main à l'utilisateur.
    if (res.status === 409) {
      const conflit = (await res.json()) as ApiErreur;
      const versionCourante = conflit.details?.current?.version;
      if (typeof versionCourante !== "number") {
        return { success: false, error: conflit.message ?? "Conflit de version sur le tableau de suivi." };
      }
      res = await patcherUneFois(id, versionCourante, patch);
      if (res.status === 409) {
        const second = (await res.json()) as ApiErreur;
        return {
          success: false,
          error: second.message ?? "Cette ligne a été modifiée entre-temps.",
          conflictKeys: second.details?.conflictKeys,
        };
      }
    }

    if (!res.ok) {
      return { success: false, error: await messageErreur(res, "PATCH /rows") };
    }
    const row = (await res.json()) as SuiviRow;
    cacheParMois.delete(row.month);
    return { success: true, row };
  }

  async function supprimerLigne(id: string): Promise<void> {
    const res = await requete(`/api/rows/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      throw new Error(`Suppression de ligne refusée : ${await messageErreur(res, "DELETE /rows")}`);
    }
    cacheParMois.clear();
  }

  return { lireLignesMois, creerLigne, patcherLigne, supprimerLigne };
}

// --- Instance de production, configurée par l'environnement -------------------------------

export function suiviConfig() {
  const { SUIVI_API_URL, SUIVI_API_EMAIL, SUIVI_API_PASSWORD } = process.env;
  return {
    url: SUIVI_API_URL,
    email: SUIVI_API_EMAIL,
    password: SUIVI_API_PASSWORD,
    configure: !!SUIVI_API_URL && !!SUIVI_API_EMAIL && !!SUIVI_API_PASSWORD,
  };
}

let instance: SuiviClient | null = null;

/** Client partagé du process (session + cache réutilisés). Lever tôt si non configuré. */
export function suiviClient(): SuiviClient {
  const c = suiviConfig();
  if (!c.configure) {
    throw new Error("Tableau de suivi non configuré (variables SUIVI_API_* manquantes).");
  }
  if (!instance) {
    instance = creerSuiviClient({ baseUrl: c.url as string, email: c.email as string, password: c.password as string });
  }
  return instance;
}
