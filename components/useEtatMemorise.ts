"use client";

import { useEffect, useRef, useState } from "react";

// Mémorise un état d'interface dans le sessionStorage de l'onglet : les ADV ouvrent un lot,
// partent consulter une fiche client, reviennent — le tableau doit les attendre tel quel.
// Portée = l'onglet du navigateur ; un nouvel onglet repart à neuf.
export function useEtatMemorise<T>(
  cle: string,
  valeurInitiale: T,
  // Reconstruit la valeur depuis le JSON stocké (utile pour un Set).
  hydrater?: (brut: unknown) => T
) {
  const [valeur, setValeur] = useState<T>(valeurInitiale);
  const charge = useRef(false);

  // Lecture après montage (jamais au rendu serveur : l'hydratation resterait cohérente).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(cle);
      if (brut !== null) {
        const parse = JSON.parse(brut) as unknown;
        setValeur(hydrater ? hydrater(parse) : (parse as T));
      }
    } catch {
      // Stockage indisponible ou JSON corrompu : on repart de la valeur initiale.
    }
    charge.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  useEffect(() => {
    if (!charge.current) return;
    try {
      sessionStorage.setItem(cle, JSON.stringify(valeur instanceof Set ? [...valeur] : valeur));
    } catch {
      // Quota plein ou navigation privée stricte : tant pis, l'état vivra le temps de la page.
    }
  }, [cle, valeur]);

  return [valeur, setValeur] as const;
}
