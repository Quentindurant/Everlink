// Mapping Everlink ↔ tableau de suivi maison (https://suivie.appgcd.fr), qui remplace le
// Zoho Sheet "TABLEAU SUIVI COMMANDES". Le tableau expose 16 colonnes identifiées par une
// clé stable (spec §2.1 du repo TableauSuivieGcDev, ordre A..P) :
//   impe, client, dpt, cp_client, partenaire, date, porta_commentaires, heure,
//   tech, nom_tech, nom_cp, statut, commentaires_planif, materiel_recu,
//   num_chrono, infos_facturation
// Les colonnes DATE y sont stockées en ISO "AAAA-MM-JJ" ; l'app et son historique Zoho
// travaillent en "JJ/MM/AAAA" : ce module fait la conversion aux frontières, si bien que
// rapprochement.ts et disponibilite.ts sont réutilisés tels quels.
import {
  extraireCodePostal,
  prefixeSemaine,
  statutSheetPourEtape,
} from "@/lib/domain/zoho/suiviSheet";
import { normaliserNomSheet, parseDateSheet } from "@/lib/domain/zoho/rapprochement";

/** Valeur d'une cellule du tableau (contrat RowDTO.data de l'API suivi). */
export type ValeurCellule = string | number | null;
export type DonneesLigne = Record<string, ValeurCellule>;

const MOIS_LIBELLES = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE",
];

/** Date → "AAAA-MM-JJ" (UTC, format des colonnes DATE du tableau) ; null → "". */
export function dateVersIso(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "";
  const a = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const j = String(d.getUTCDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

/** "AAAA-MM-JJ" → "JJ/MM/AAAA" ; toute autre saisie (cellule libre) repart telle quelle. */
export function isoVersFr(valeur: string): string {
  const v = valeur.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Mois "AAAA-MM" d'une date (UTC). */
export function moisCourant(d = new Date()): string {
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mois cible d'un dossier : celui de la date d'intervention, sinon le mois courant. */
export function moisDuDossier(dateIntervention: Date | null, maintenant = new Date()): string {
  return moisCourant(dateIntervention ?? maintenant);
}

/** "2026-08" → "AOUT 2026", le libellé des onglets mensuels historiques (affichage). */
export function libelleMoisSuivi(mois: string): string {
  const m = mois.match(/^(\d{4})-(\d{2})$/);
  if (!m) return mois;
  const index = Number(m[2]) - 1;
  if (index < 0 || index > 11) return mois;
  return `${MOIS_LIBELLES[index]} ${m[1]}`;
}

/** Champs du dossier Everlink nécessaires pour composer une ligne du tableau. */
export interface DossierPourSuivi {
  raisonSociale: string;
  departement: string | null;
  adresse: string | null;
  scenario: string | null;
  dateIntervention: Date | null;
  creneauIntervention: string | null;
  commentaire: string | null;
  referenceClient: string | null;
  contactNom: string | null;
  contactPrenom: string | null;
  /** Chef de projet GC du dossier, écrit dans la colonne nom_cp. */
  chefProjetNom: string | null;
  etapeLibelle: string | null;
  prestataireNom: string | null;
  technicienNom: string | null;
  statutSuivi: string | null;
  dateImperative: Date | null;
  materielRecu: string | null;
  numeroChrono: string | null;
  infosFacturation: string | null;
}

/**
 * PUSH : dossier Everlink → cellules de la ligne, au format des ADV (client préfixé de la
 * semaine de pose, statut au vocabulaire du tableau). Les champs vides sont omis : une
 * cellule absente reste vide côté tableau. IMPE, MATERIEL RECU, N° CHRONO et INFOS
 * FACTURATION partent s'ils sont connus mais restent ensuite à la main des ADV.
 */
export function construireDonneesLigne(c: DossierPourSuivi): Record<string, string> {
  const brut: Record<string, string> = {
    impe: dateVersIso(c.dateImperative),
    client: `${prefixeSemaine(c.dateIntervention)}${c.raisonSociale}`,
    dpt: c.departement ?? "",
    cp_client: extraireCodePostal(c.adresse),
    // Les dossiers gérés par GC pour Everlink portent le partenaire "EVERLINK".
    partenaire: "EVERLINK",
    date: dateVersIso(c.dateIntervention),
    porta_commentaires: [c.scenario, c.referenceClient].filter(Boolean).join(" — "),
    heure: c.creneauIntervention ?? "",
    tech: c.prestataireNom ?? "",
    nom_tech: c.technicienNom ?? "",
    // nom_cp = chef de projet GC qui pilote le dossier (pas le contact chez le client).
    nom_cp: c.chefProjetNom ?? "",
    // Le statut saisi par les ADV prime ; sinon on le dérive de l'étape de migration.
    statut: c.statutSuivi ?? statutSheetPourEtape(c.etapeLibelle),
    commentaires_planif: c.commentaire ?? "",
    materiel_recu: c.materielRecu ?? "",
    num_chrono: c.numeroChrono ?? "",
    infos_facturation: c.infosFacturation ?? "",
  };
  const donnees: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(brut)) {
    if (valeur !== "") donnees[cle] = valeur;
  }
  return donnees;
}

/** Verdict de la recherche de la ligne d'un dossier dans son mois (upsert du push). */
export type ResultatLigneCible<L> =
  | { type: "unique"; ligne: L }
  | { type: "ambigu"; nombre: number }
  | { type: "absente" };

/**
 * PUSH : retrouve la ligne du mois qui appartient déjà à ce dossier, pour la METTRE À JOUR
 * au lieu d'en créer un doublon. Comparaison au nom normalisé du rapprochement (préfixe
 * semaine retiré, casse et espaces ignorés) : priorité au nom mémorisé `zohoNomSheet` —
 * il survit à un renommage du dossier côté app —, repli sur le nom actuel si le mémorisé
 * ne retrouve rien (ligne renommée par les ADV). Les lignes archivées et les cellules
 * client vides ne comptent jamais. Plusieurs correspondances → « ambigu » : l'appelant ne
 * doit RIEN écrire (fusion à faire côté tableau), surtout pas créer un doublon de plus.
 */
export function trouverLigneCible<L extends { data: DonneesLigne; archived?: boolean }>(
  lignes: L[],
  nomMemorise: string | null,
  nomActuel: string
): ResultatLigneCible<L> {
  const vivantes = lignes.filter((l) => !l.archived);
  const correspondantes = (nom: string | null): L[] => {
    const norme = nom ? normaliserNomSheet(nom) : "";
    if (!norme) return [];
    return vivantes.filter((l) => normaliserNomSheet(S(l.data["client"])) === norme);
  };
  for (const nom of [nomMemorise, nomActuel]) {
    const trouvees = correspondantes(nom);
    if (trouvees.length === 1) return { type: "unique", ligne: trouvees[0] };
    if (trouvees.length > 1) return { type: "ambigu", nombre: trouvees.length };
  }
  return { type: "absente" };
}

/** Ligne du tableau vue par l'app — même forme que l'ancienne LigneZoho (UI, pull, dispo). */
export interface LigneSuivi {
  client: string;
  dpt: string;
  /** Format "JJ/MM/AAAA" (converti depuis l'ISO du tableau) pour l'affichage et le pull. */
  date: string;
  heure: string;
  tech: string;
  nomTech: string;
  /** Chef de projet GC en charge du dossier (colonne nom_cp). */
  nomCp: string;
  installation: string;
  commentaires: string;
}

const S = (v: unknown) => (v == null ? "" : String(v));

/** Vrai si la ligne appartient à Everlink (colonne partenaire), casse/espaces ignorés. */
export function estLigneEverlink(data: Record<string, unknown>): boolean {
  return S(data["partenaire"]).trim().toUpperCase() === "EVERLINK";
}

/** PULL : cellules d'une ligne du tableau → forme historique consommée par l'app. */
export function ligneDepuisRow(data: DonneesLigne): LigneSuivi {
  return {
    client: S(data["client"]),
    dpt: S(data["dpt"]),
    date: isoVersFr(S(data["date"])),
    heure: S(data["heure"]),
    tech: S(data["tech"]),
    nomTech: S(data["nom_tech"]),
    nomCp: S(data["nom_cp"]),
    installation: S(data["statut"]),
    commentaires: S(data["porta_commentaires"]),
  };
}

/**
 * Affectations (NOM TECH + DATE) de TOUTES les lignes du mois, tous partenaires : un
 * technicien occupé sur un dossier GC n'est pas disponible pour Everlink. Dates au format
 * FR pour nomsTechOccupes (lib/domain/technicien/disponibilite).
 */
export function affectationsDepuisRows(rows: { data: DonneesLigne }[]): { nomTech: string; date: string }[] {
  return rows.map((r) => ({
    nomTech: S(r.data["nom_tech"]),
    date: isoVersFr(S(r.data["date"])),
  }));
}

/** Champs du dossier comparés lors du pull (sous-ensemble du client Prisma). */
export interface DossierRapproche {
  zohoNomSheet: string | null;
  statutSuivi: string | null;
  dateIntervention: Date | null;
  creneauIntervention: string | null;
  technicienId: string | null;
  chefProjetNom: string | null;
}

/**
 * PULL : champs à écrire sur le dossier pour refléter la ligne rapprochée. Règle d'or :
 * un champ vide (ou illisible) côté tableau ne touche JAMAIS la valeur de l'app ; une
 * valeur identique n'est pas réécrite. `techIdResolu` est résolu en amont (annuaire +
 * création éventuelle), null = ne pas toucher l'affectation.
 */
export function champsAMettreAJour(
  dossier: DossierRapproche,
  ligne: Pick<LigneSuivi, "date" | "heure" | "installation" | "nomCp">,
  nomSheet: string,
  techIdResolu: string | null
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (dossier.zohoNomSheet !== nomSheet) data.zohoNomSheet = nomSheet;

  const statut = ligne.installation.trim().toUpperCase();
  if (statut && statut !== (dossier.statutSuivi ?? "")) data.statutSuivi = statut;

  const date = parseDateSheet(ligne.date);
  if (date && date.getTime() !== (dossier.dateIntervention?.getTime() ?? 0)) {
    data.dateIntervention = date;
  }

  const heure = ligne.heure.trim();
  if (heure && heure !== (dossier.creneauIntervention ?? "")) data.creneauIntervention = heure;

  if (techIdResolu && techIdResolu !== dossier.technicienId) data.technicienId = techIdResolu;

  // Le chef de projet vient du tableau : c'est lui qu'on alertera si un prestataire du
  // client reste sans réponse à l'approche de l'intervention. Une case vide ne l'efface pas.
  const cp = ligne.nomCp.trim();
  if (cp && cp !== (dossier.chefProjetNom ?? "")) data.chefProjetNom = cp;

  return data;
}
