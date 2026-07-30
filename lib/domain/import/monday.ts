import type ExcelJS from "exceljs";

// Parsing du xlsx Monday (SPEC §4), format observé sur Migration_GC_1785166222.xlsx:
// ligne 1 titre du board, ligne 2 nom du groupe, ligne 3 en-têtes (47 colonnes),
// lignes suivantes un client chacune. Une ligne à cellule unique est un séparateur
// de groupe (nouveau lot). La dernière ligne de totaux (Name vide) est ignorée.

export interface MondayLigne {
  codeMonday: string | null;
  raisonSociale: string;
  lotNom: string | null;
  filiale: string | null;
  scenario: string | null;
  adresse: string | null;
  dateIntervention: Date | null;
  clientVip: boolean;
  typeIntervention: string | null;
  statutMonday: string | null;
  commentaire: string | null;
  nbPostesAnnonce: number | null;
  contactNom: string | null;
  contactPrenom: string | null;
  contactFixe: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  technoLien: string | null;
  debit: string | null;
  modeleCpe: string | null;
  departement: string | null;
  postesDeployes: string[];
  // Toutes les colonnes non mappées, stockées dans Client.mondayRaw.
  champsBruts: Record<string, unknown>;
}

export interface RapprochementResultat {
  aCreer: MondayLigne[];
  aMettreAJour: { ligne: MondayLigne; clientId: string }[];
  // Aucun rapprochement flou automatique (SPEC §4): en cas de doute l'opérateur tranche.
  aRapprocher: { ligne: MondayLigne; candidats: { id: string; raisonSociale: string }[] }[];
  modelesInconnus: string[];
}

export function normaliserRaisonSociale(brut: string): string {
  return brut.trim().replace(/\s+/g, " ").toUpperCase();
}

const MAPPING: Record<string, keyof MondayLigne> = {
  Name: "codeMonday",
  Filiale: "filiale",
  "Raison sociale": "raisonSociale",
  Scénario: "scenario",
  Adresse: "adresse",
  "Date d'inter": "dateIntervention",
  Intervention: "typeIntervention",
  Statut: "statutMonday",
  Commentaire: "commentaire",
  "NB DE POSTE": "nbPostesAnnonce",
  "Nom (contact)": "contactNom",
  "Prénom (contact)": "contactPrenom",
  "Fixe (contact)": "contactFixe",
  "Mobile (contact)": "contactMobile",
  "Mail (contact)": "contactEmail",
  "Techno lien": "technoLien",
  Débit: "debit",
  "Modèle CPE": "modeleCpe",
  LOT: "lotNom",
  Département: "departement",
};

function celluleTexte(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  if (valeur instanceof Date) return valeur.toISOString();
  // exceljs renvoie des objets pour les formules et les rich-text: on prend le résultat.
  if (typeof valeur === "object") {
    const v = valeur as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return celluleTexte(v.result);
    return null;
  }
  const texte = String(valeur).trim();
  return texte === "" ? null : texte;
}

export function parseMondayWorkbook(wb: ExcelJS.Workbook): {
  lignes: MondayLigne[];
  erreurs: string[];
} {
  const erreurs: string[] = [];
  const ws = wb.worksheets[0];
  if (!ws) return { lignes: [], erreurs: ["Classeur vide."] };

  // Ligne 2: groupe initial. Ligne 3: en-têtes.
  const lotInitial = celluleTexte(ws.getRow(2).getCell(1).value);
  const enteteRow = ws.getRow(3);
  const entetes: string[] = [];
  enteteRow.eachCell({ includeEmpty: true }, (cell, col) => {
    entetes[col] = celluleTexte(cell.value) ?? `Colonne ${col}`;
  });
  if (entetes.filter(Boolean).length < 3) {
    return { lignes: [], erreurs: ["Ligne 3 : en-têtes introuvables — format inattendu."] };
  }

  const lignes: MondayLigne[] = [];
  let lotCourant = lotInitial;

  for (let i = 4; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const valeurs = new Map<number, unknown>();
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (cell.value !== null && cell.value !== undefined && celluleTexte(cell.value) !== null) {
        valeurs.set(col, cell.value);
      }
    });
    if (valeurs.size === 0) continue;

    // Séparateur de groupe: une seule cellule remplie, hors ligne d'en-tête.
    if (valeurs.size === 1) {
      const seule = celluleTexte(valeurs.values().next().value);
      if (seule) lotCourant = seule;
      continue;
    }

    const name = celluleTexte(row.getCell(entetes.indexOf("Name")).value);
    const raisonSociale = celluleTexte(row.getCell(entetes.indexOf("Raison sociale")).value);

    // Ligne de totaux: Name vide. À ignorer (SPEC §4).
    if (!name && !raisonSociale) continue;
    if (!raisonSociale) {
      erreurs.push(`Ligne ${i} : raison sociale absente, ligne ignorée.`);
      continue;
    }

    const ligne: MondayLigne = {
      codeMonday: null,
      raisonSociale,
      lotNom: lotCourant,
      filiale: null,
      scenario: null,
      adresse: null,
      dateIntervention: null,
      clientVip: false,
      typeIntervention: null,
      statutMonday: null,
      commentaire: null,
      nbPostesAnnonce: null,
      contactNom: null,
      contactPrenom: null,
      contactFixe: null,
      contactMobile: null,
      contactEmail: null,
      technoLien: null,
      debit: null,
      modeleCpe: null,
      departement: null,
      postesDeployes: [],
      champsBruts: {},
    };

    for (let col = 1; col < entetes.length; col++) {
      const entete = entetes[col];
      if (!entete) continue;
      const brut = row.getCell(col).value;
      if (brut === null || brut === undefined) continue;

      if (entete === "Date d'inter") {
        // Cellules déjà typées date dans le xlsx: ne jamais parser de chaîne (SPEC §4).
        if (brut instanceof Date) ligne.dateIntervention = brut;
        continue;
      }
      if (entete === "NB DE POSTE") {
        const n = typeof brut === "number" ? brut : Number(celluleTexte(brut));
        ligne.nbPostesAnnonce = Number.isFinite(n) ? n : null;
        continue;
      }
      if (entete === "Clt VIP") {
        const t = celluleTexte(brut)?.toLowerCase();
        ligne.clientVip = t === "oui" || t === "true" || t === "vip" || t === "v" || t === "✓";
        continue;
      }
      if (entete === "Postes déployées") {
        const t = celluleTexte(brut);
        ligne.postesDeployes = t
          ? t.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        ligne.champsBruts[entete] = t;
        continue;
      }

      const champ = MAPPING[entete];
      const texte = celluleTexte(brut);
      if (champ && champ !== "raisonSociale") {
        (ligne as unknown as Record<string, unknown>)[champ] = texte;
      } else if (!champ) {
        // Colonne non mappée: conservée en Json (SPEC §4).
        ligne.champsBruts[entete] = texte;
      }
    }

    lignes.push(ligne);
  }

  return { lignes, erreurs };
}

export function rapprocher(
  lignes: MondayLigne[],
  existants: { id: string; codeMonday: string | null; raisonSociale: string }[],
  modelesConnus: string[]
): RapprochementResultat {
  const parCode = new Map(
    existants.filter((e) => e.codeMonday).map((e) => [e.codeMonday as string, e])
  );
  const parRaison = new Map(
    existants.map((e) => [normaliserRaisonSociale(e.raisonSociale), e])
  );
  const modelesNormalises = new Set(modelesConnus.map((m) => m.trim().toLowerCase()));

  const resultat: RapprochementResultat = {
    aCreer: [],
    aMettreAJour: [],
    aRapprocher: [],
    modelesInconnus: [],
  };
  const inconnusVus = new Set<string>();

  for (const ligne of lignes) {
    for (const modele of ligne.postesDeployes) {
      const cle = modele.trim().toLowerCase();
      if (!modelesNormalises.has(cle) && !inconnusVus.has(cle)) {
        inconnusVus.add(cle);
        resultat.modelesInconnus.push(modele);
      }
    }

    const parCodeMatch = ligne.codeMonday ? parCode.get(ligne.codeMonday) : undefined;
    if (parCodeMatch) {
      resultat.aMettreAJour.push({ ligne, clientId: parCodeMatch.id });
      continue;
    }

    const raisonNormalisee = normaliserRaisonSociale(ligne.raisonSociale);
    const parRaisonMatch = parRaison.get(raisonNormalisee);
    if (parRaisonMatch) {
      resultat.aMettreAJour.push({ ligne, clientId: parRaisonMatch.id });
      continue;
    }

    // Candidats proposés à l'opérateur: même début de raison sociale (pas de flou automatique).
    const prefixe = raisonNormalisee.split(" ")[0];
    const candidats = existants
      .filter((e) => normaliserRaisonSociale(e.raisonSociale).startsWith(prefixe))
      .map((e) => ({ id: e.id, raisonSociale: e.raisonSociale }));

    if (candidats.length > 0) {
      resultat.aRapprocher.push({ ligne, candidats });
    } else {
      resultat.aCreer.push(ligne);
    }
  }

  return resultat;
}
