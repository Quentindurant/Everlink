// Pont réseau vers le référentiel commun des techniciens (colonne SELECT `nom_tech`
// du tableau de suivi). Tout est MEILLEUR EFFORT : le tableau peut être injoignable,
// la colonne encore TEXT pendant la transition, ou l'ajout refusé — aucune de ces
// fonctions ne lève, l'appelant (push d'un dossier, pull cron) continue son travail.
import { CLE_COLONNE_NOM_TECH, nomDejaDansChoix } from "@/lib/domain/suivi/referentielTechniciens";
import type { SuiviClient } from "./suiviClient";

type ClientReferentiel = Pick<SuiviClient, "lireColonnes" | "ajouterChoix">;

function journaliserEchec(contexte: string, e: unknown): void {
  console.warn(`[suivi] ${contexte} :`, e instanceof Error ? e.message : e);
}

/**
 * Libellés actifs du référentiel (archivés exclus : ils ne sont plus proposés à la
 * saisie côté tableau). Liste vide si le tableau est injoignable ou la colonne absente
 * — le pull reste alors le pull classique, sans création depuis le référentiel.
 */
export async function lireLabelsReferentiel(client: ClientReferentiel): Promise<string[]> {
  try {
    const colonnes = await client.lireColonnes();
    const colonne = colonnes.find((c) => c.key === CLE_COLONNE_NOM_TECH);
    return (colonne?.choices ?? []).filter((c) => !c.archived).map((c) => c.label);
  } catch (e) {
    journaliserEchec("Référentiel techniciens illisible, on continue sans", e);
    return [];
  }
}

/**
 * Ajoute le technicien à la liste `nom_tech` s'il n'y figure pas déjà (comparaison
 * insensible casse/espaces/accents, archivés compris — re-créer un libellé archivé
 * ferait un 422 doublon à chaque push). Renvoie true si un choix a été ajouté.
 * Ne lève JAMAIS : un échec (colonne absente ou encore TEXT, réseau, 4xx) est
 * journalisé et le push reste réussi.
 */
export async function ajouterTechAuReferentiel(
  client: ClientReferentiel,
  nomTech: string | null | undefined
): Promise<boolean> {
  const nom = (nomTech ?? "").trim();
  if (!nom) return false;
  try {
    const colonnes = await client.lireColonnes();
    const colonne = colonnes.find((c) => c.key === CLE_COLONNE_NOM_TECH);
    // Colonne absente ou pas encore SELECT (transition en prod) : référentiel inactif.
    if (!colonne || colonne.type !== "SELECT") return false;
    if (nomDejaDansChoix(colonne.choices.map((c) => c.label), nom)) return false;
    await client.ajouterChoix(colonne.id, nom);
    return true;
  } catch (e) {
    journaliserEchec(`Ajout de « ${nom} » au référentiel techniciens impossible, push conservé`, e);
    return false;
  }
}
