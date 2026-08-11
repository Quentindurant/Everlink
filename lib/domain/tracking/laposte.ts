// Types et logique pure du suivi de colis via l'API La Poste Suivi v2, qui couvre Chronopost,
// Colissimo et la lettre suivie. Aucune dépendance réseau ni Prisma ici : la fonction
// `etatDeShipment` est testable seule. Le client HTTP vit dans lib/tracking/laPosteClient.ts.

// Réponse brute de l'API (repris du DTO du CRM Synapse — même API La Poste).
export interface TrackingEvent {
  date: string;
  label: string;
  code: string;
}

export interface Shipment {
  idShip: string;
  holder: number; // 3 = Chronopost, 4 = Colissimo, 1/2 = courrier
  product: string;
  isFinal: boolean;
  entryDate?: string;
  deliveryDate?: string;
  event?: TrackingEvent[];
}

export interface LaPosteTrackingResponse {
  returnCode: number; // 200, 400, 404, 5xx
  returnMessage?: string;
  idShip?: string;
  shipment?: Shipment;
}

// Statut normalisé, volontairement minimal et fiable. On ne tente pas de deviner un "problème"
// via une table de codes fragile : on remonte le libellé brut du dernier événement pour l'humain.
export type SuiviStatut = "EN_COURS" | "LIVRE" | "INCONNU";

export interface EtatSuivi {
  statut: SuiviStatut;
  // Dernier événement lisible ("Votre colis est livré", "Pris en charge par Chronopost"…).
  libelle: string | null;
  // Date de livraison ISO si le colis est arrivé.
  livreLe: string | null;
}

// Un numéro de suivi La Poste/Chronopost fait 11 à 15 caractères alphanumériques.
export function numeroSuiviValide(numero: string): boolean {
  const n = numero.trim();
  return n.length >= 11 && n.length <= 15 && /^[A-Za-z0-9]+$/.test(n);
}

// Seuls les transporteurs couverts par l'API La Poste (Chronopost, Colissimo, lettre suivie)
// ont un suivi temps réel. DHL et consorts sont acceptés à l'expédition mais sans relevé
// automatique : le bon est saisi, affiché et lié au site du transporteur.
export function transporteurAvecSuiviApi(transporteur: string | null): boolean {
  const t = (transporteur ?? "").toLowerCase();
  return t === "" || t.includes("chrono") || t.includes("poste") || t.includes("colissimo");
}

// Validation selon le transporteur : stricte pour La Poste/Chronopost (l'API refuse le reste),
// large pour les autres (DHL Express = 10 chiffres, DHL Parcel = JJD/JVGL + suite longue).
export function numeroSuiviValidePour(transporteur: string | null, numero: string): boolean {
  const n = numero.trim();
  if (!/^[A-Za-z0-9]+$/.test(n)) return false;
  if (transporteurAvecSuiviApi(transporteur)) return n.length >= 11 && n.length <= 15;
  return n.length >= 8 && n.length <= 30;
}

// URL de suivi publique pour les transporteurs sans API (ouverte dans un nouvel onglet).
export function urlSuiviTransporteur(transporteur: string | null, numero: string): string | null {
  const t = (transporteur ?? "").toLowerCase();
  if (t.includes("dhl")) {
    return `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${encodeURIComponent(numero)}`;
  }
  return null;
}

// Dérive l'état normalisé d'une réponse API. Robuste : s'appuie sur `isFinal` + `deliveryDate`
// fournis par La Poste plutôt que sur les codes d'événement, qui varient selon le transporteur.
export function etatDeShipment(reponse: LaPosteTrackingResponse): EtatSuivi {
  if (reponse.returnCode === 404 || !reponse.shipment) {
    return { statut: "INCONNU", libelle: reponse.returnMessage ?? null, livreLe: null };
  }
  const s = reponse.shipment;
  const dernier = s.event && s.event.length > 0 ? s.event[0] : null;
  const libelle = dernier?.label ?? null;
  const livre = s.isFinal === true && !!s.deliveryDate;
  return {
    statut: livre ? "LIVRE" : "EN_COURS",
    libelle,
    livreLe: livre ? (s.deliveryDate as string) : null,
  };
}

export const LIBELLE_SUIVI: Record<SuiviStatut, string> = {
  EN_COURS: "En cours",
  LIVRE: "Livré",
  INCONNU: "Inconnu",
};

// Teinte pastel du design system par statut, pour les pastilles côté staging et ADV.
export const PAL_SUIVI: Record<SuiviStatut, string> = {
  EN_COURS: "blue",
  LIVRE: "green",
  INCONNU: "gray",
};
