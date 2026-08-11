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

// Même raison sociale, adresse différente : un client à plusieurs établissements. Les postes
// restent sur un seul client (ils s'appellent entre eux), chaque adresse devient un site.
export interface SiteDetecte {
  ligne: MondayLigne;
  // Client existant concerné, null si le client est créé par une autre ligne du même fichier.
  clientId: string | null;
  raisonSociale: string;
  // "fichier" : plusieurs lignes du fichier portent ce nom.
  // "adresse" : la ligne vise un client existant mais à une autre adresse.
  motif: "fichier" | "adresse";
}

export interface RapprochementResultat {
  aCreer: MondayLigne[];
  aMettreAJour: { ligne: MondayLigne; clientId: string }[];
  // Aucun rapprochement flou automatique (SPEC §4): en cas de doute l'opérateur tranche.
  aRapprocher: { ligne: MondayLigne; candidats: { id: string; raisonSociale: string }[] }[];
  // Lignes proposées en site supplémentaire d'un client (l'opérateur confirme).
  sites: SiteDetecte[];
  modelesInconnus: string[];
}

export function normaliserRaisonSociale(brut: string): string {
  return brut.trim().replace(/\s+/g, " ").toUpperCase();
}

// Libellé court d'un site déduit de son adresse : la ville qui suit le code postal
// ("79 RUE DES CHANTIERS 78000 Versailles" → "Versailles"). Sans code postal, on garde
// le début de l'adresse — le nom reste modifiable dans la fiche client.
export function nomSiteDepuisAdresse(adresse: string | null, defaut: string): string {
  const t = (adresse ?? "").trim();
  if (!t) return defaut;
  const ville = t.match(/\b\d{5}\b\s+(.+)$/)?.[1]?.trim();
  if (ville) return ville.length > 40 ? ville.slice(0, 40) : ville;
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
}

// Comparaison d'adresses tolérante à la casse, aux espaces et à la ponctuation : deux
// écritures de la même adresse ne doivent pas créer un faux site.
export function memeAdresse(a: string | null, b: string | null): boolean {
  const cle = (v: string | null) =>
    (v ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  return cle(a) === cle(b);
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
  existants: {
    id: string;
    codeMonday: string | null;
    raisonSociale: string;
    adresse?: string | null;
    // Sites déjà connus du client (multi-établissements).
    sites?: { codeMonday: string | null; adresse: string | null }[];
  }[],
  modelesConnus: string[]
): RapprochementResultat {
  const parCode = new Map(
    existants.filter((e) => e.codeMonday).map((e) => [e.codeMonday as string, e])
  );
  const parRaison = new Map(
    existants.map((e) => [normaliserRaisonSociale(e.raisonSociale), e])
  );
  // Code Monday d'un site déjà créé → le client auquel il appartient.
  const parSiteCode = new Map<string, (typeof existants)[number]>();
  for (const e of existants) {
    for (const s of e.sites ?? []) {
      if (s.codeMonday) parSiteCode.set(s.codeMonday, e);
    }
  }
  const modelesNormalises = new Set(modelesConnus.map((m) => m.trim().toLowerCase()));

  // Raisons sociales portées par plusieurs lignes du fichier : un seul client, plusieurs sites.
  const compteFichier = new Map<string, number>();
  for (const l of lignes) {
    const cle = normaliserRaisonSociale(l.raisonSociale);
    compteFichier.set(cle, (compteFichier.get(cle) ?? 0) + 1);
  }
  // Première ligne de chaque groupe : elle crée (ou met à jour) le client, les suivantes
  // deviennent des sites.
  const premiereVue = new Set<string>();

  const resultat: RapprochementResultat = {
    aCreer: [],
    aMettreAJour: [],
    aRapprocher: [],
    sites: [],
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

    const raisonNormalisee = normaliserRaisonSociale(ligne.raisonSociale);
    const parRaisonMatch = parRaison.get(raisonNormalisee);
    // Le code Monday du client l'emporte : c'est sa propre ligne (le site principal porte
    // le même code, il ne doit pas détourner la mise à jour de la fiche).
    const parCodeMatch = ligne.codeMonday ? parCode.get(ligne.codeMonday) : undefined;
    if (parCodeMatch) {
      resultat.aMettreAJour.push({ ligne, clientId: parCodeMatch.id });
      // Le groupe est traité : les autres lignes du même nom deviendront des sites.
      premiereVue.add(raisonNormalisee);
      continue;
    }

    // Une ligne déjà importée comme site le reste : sinon un ré-import écraserait la fiche
    // client avec l'adresse du second établissement.
    const parSiteMatch = ligne.codeMonday ? parSiteCode.get(ligne.codeMonday) : undefined;
    if (parSiteMatch) {
      resultat.sites.push({
        ligne,
        clientId: parSiteMatch.id,
        raisonSociale: parSiteMatch.raisonSociale,
        motif: "adresse",
      });
      continue;
    }

    // Doublon interne au fichier : la première ligne fait le client, les suivantes des sites.
    if ((compteFichier.get(raisonNormalisee) ?? 0) > 1 && premiereVue.has(raisonNormalisee)) {
      resultat.sites.push({
        ligne,
        clientId: parRaisonMatch?.id ?? null,
        raisonSociale: parRaisonMatch?.raisonSociale ?? ligne.raisonSociale,
        motif: "fichier",
      });
      continue;
    }
    premiereVue.add(raisonNormalisee);

    if (parRaisonMatch) {
      // Adresse différente de celle du client et de ses sites connus : nouvel établissement.
      const connues = [
        parRaisonMatch.adresse ?? null,
        ...(parRaisonMatch.sites ?? []).map((s) => s.adresse),
      ];
      const adresseInedite =
        !!ligne.adresse?.trim() &&
        connues.some((a) => !!a?.trim()) &&
        !connues.some((a) => memeAdresse(a, ligne.adresse));
      if (adresseInedite) {
        resultat.sites.push({
          ligne,
          clientId: parRaisonMatch.id,
          raisonSociale: parRaisonMatch.raisonSociale,
          motif: "adresse",
        });
      } else {
        resultat.aMettreAJour.push({ ligne, clientId: parRaisonMatch.id });
      }
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
