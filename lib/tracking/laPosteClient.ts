// Client HTTP de l'API La Poste Suivi v2 (Chronopost / Colissimo / lettre suivie).
// Auth par clé API en en-tête `X-Okapi-Key` (variable API_KEY_LAPOSTE, jamais committée).
// Cache mémoire 5 min pour respecter la limite de 100 appels/min ; le process pm2 est unique.
import {
  etatDeShipment,
  numeroSuiviValide,
  type EtatSuivi,
  type LaPosteTrackingResponse,
} from "@/lib/domain/tracking/laposte";

const API_BASE = "https://api.laposte.fr/suivi/v2/idships/";
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; etat: EtatSuivi }>();

export function laPosteConfigure(): boolean {
  return !!process.env.API_KEY_LAPOSTE;
}

// Interroge le suivi d'un numéro. Renvoie l'état normalisé, ou null si le numéro est invalide,
// la clé absente, ou le service indisponible (l'appelant garde alors l'état précédent).
export async function suivreColis(numeroSuivi: string): Promise<EtatSuivi | null> {
  const numero = numeroSuivi.trim();
  if (!numeroSuiviValide(numero)) return null;

  const cached = cache.get(numero);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.etat;

  const cle = process.env.API_KEY_LAPOSTE;
  if (!cle) return null;

  try {
    const res = await fetch(`${API_BASE}${numero}?lang=fr_FR`, {
      method: "GET",
      headers: { Accept: "application/json", "X-Okapi-Key": cle },
    });
    // 401/403 (clé invalide), 429 (quota) : on n'écrase pas l'état existant.
    if (res.status === 401 || res.status === 403 || res.status === 429) return null;

    const data = (await res.json()) as LaPosteTrackingResponse;
    if (data.returnCode >= 500) return null;

    const etat = etatDeShipment(data);
    cache.set(numero, { at: Date.now(), etat });
    return etat;
  } catch {
    return null;
  }
}
