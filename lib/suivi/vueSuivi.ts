// Lectures "résilientes" du tableau de suivi pour l'app (remplacent lireLignesSheet et
// lireAffectationsSheet du client Zoho) : jamais d'exception, on dégrade en liste vide
// pour que la page Techniciens et la disponibilité restent utilisables hors ligne.
import {
  affectationsDepuisRows,
  estLigneEverlink,
  libelleMoisSuivi,
  ligneDepuisRow,
  moisCourant,
  type LigneSuivi,
} from "@/lib/domain/suivi/ligneSuivi";
import { suiviClient, suiviConfig } from "./suiviClient";

/** Vue live (page Techniciens) : lignes EVERLINK du mois courant, format historique. */
export async function lireVueSuivi(): Promise<{
  configure: boolean;
  onglet: string;
  lignes: LigneSuivi[];
}> {
  const mois = moisCourant();
  const onglet = libelleMoisSuivi(mois);
  if (!suiviConfig().configure) return { configure: false, onglet, lignes: [] };
  try {
    const rows = await suiviClient().lireLignesMois(mois);
    return {
      configure: true,
      onglet,
      lignes: rows.filter((r) => !r.archived && estLigneEverlink(r.data)).map((r) => ligneDepuisRow(r.data)),
    };
  } catch {
    return { configure: true, onglet, lignes: [] };
  }
}

/**
 * Affectations (NOM TECH + DATE, format FR) de TOUTES les lignes du mois courant, tous
 * partenaires : un technicien occupé sur un dossier GC n'est pas disponible pour Everlink.
 * [] si non configuré ou en erreur (la dispo retombe sur les seules affectations de l'app).
 */
export async function lireAffectationsSuivi(): Promise<{ nomTech: string; date: string }[]> {
  if (!suiviConfig().configure) return [];
  try {
    return affectationsDepuisRows(await suiviClient().lireLignesMois(moisCourant()));
  } catch {
    return [];
  }
}
