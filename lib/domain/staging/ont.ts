// Règles de la reprise des ONT chez les clients, sans base ni réseau : le chef de projet
// relève un numéro de série ou justifie l'absence d'appareil, le staging coche la réception,
// puis les ONT reçus repartent au grossiste par lots.

import { numeroSuiviValidePour } from "@/lib/domain/tracking/laposte";

/** Longueur minimale d'un numéro de série d'ONT : en dessous, c'est une saisie tronquée. */
const LONGUEUR_MIN_SERIE = 8;

export interface SaisieOnt {
  numeroSerie: string;
  raison: string;
}

export type ResultatSaisie =
  | { ok: true; mode: "numero"; numeroSerie: string }
  | { ok: true; mode: "absence"; raison: string }
  | { ok: false; message: string };

// Les constructeurs impriment le numéro avec des espaces ou des tirets qui varient d'une
// étiquette à l'autre ; seuls les caractères comptent pour l'identité de l'appareil.
export function normaliserNumeroSerie(brut: string): string {
  return brut.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * @param numerosExistants numéro de série normalisé → raison sociale du client qui le détient.
 */
export function valideSaisieOnt(
  saisie: SaisieOnt,
  numerosExistants: Map<string, string>
): ResultatSaisie {
  const numero = normaliserNumeroSerie(saisie.numeroSerie);
  const raison = saisie.raison.trim();

  if (numero) {
    if (numero.length < LONGUEUR_MIN_SERIE) {
      return { ok: false, message: "Numéro de série trop court, vérifiez l'étiquette." };
    }
    // Deux clients ne rendent pas le même appareil : c'est une faute de frappe, et la nommer
    // évite de chercher longtemps.
    const detenteur = numerosExistants.get(numero);
    if (detenteur) {
      return { ok: false, message: `Ce numéro est déjà enregistré pour ${detenteur}.` };
    }
    return { ok: true, mode: "numero", numeroSerie: numero };
  }

  if (raison) return { ok: true, mode: "absence", raison };

  return {
    ok: false,
    message: "Saisissez le numéro de série de l'ONT, ou la raison de son absence.",
  };
}

export function peutEntrerDansLot(article: {
  dateReception: Date | null;
  lotRetourId: string | null;
}): boolean {
  // Un ONT annoncé mais pas encore arrivé ne peut pas être mis dans un carton.
  return article.dateReception !== null && article.lotRetourId === null;
}

// Le lot est un carton réel : on ne retire pas un appareil de la base sans l'avoir d'abord
// sorti du lot, sinon le bordereau remis au grossiste ne correspond plus à son contenu.
export function peutSupprimerOnt(article: { lotRetourId: string | null }): boolean {
  return article.lotRetourId === null;
}

export function valideClotureLot(lot: {
  nbArticles: number;
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): { ok: true } | { ok: false; message: string } {
  if (lot.nbArticles === 0) {
    return { ok: false, message: "Le lot est vide : ajoutez au moins un ONT avant de l'expédier." };
  }
  if (!lot.destinataire.trim()) {
    return { ok: false, message: "Indiquez le destinataire du lot." };
  }
  if (!lot.transporteur.trim()) {
    return { ok: false, message: "Indiquez le transporteur." };
  }
  if (!numeroSuiviValidePour(lot.transporteur, lot.numeroSuivi)) {
    return { ok: false, message: `Numéro de suivi invalide pour ${lot.transporteur}.` };
  }
  return { ok: true };
}
