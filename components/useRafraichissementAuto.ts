"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit les données serveur de la page sans rechargement : au retour sur l'onglet, puis
// par intervalle tant que l'onglet est visible. En arrière-plan, aucune requête — le quota
// Prisma est une contrainte réelle, et une page ouverte toute la journée ne doit pas la
// consommer pour rien.
export function useRafraichissementAuto(intervalleMs = 300_000) {
  const router = useRouter();

  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const minuteur = setInterval(rafraichir, intervalleMs);
    document.addEventListener("visibilitychange", rafraichir);
    window.addEventListener("focus", rafraichir);

    return () => {
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", rafraichir);
      window.removeEventListener("focus", rafraichir);
    };
  }, [router, intervalleMs]);
}
