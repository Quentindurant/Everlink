import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import {
  normaliserRaisonSociale,
  parseMondayWorkbook,
  rapprocher,
  type MondayLigne,
} from "./monday";

const ENTETES = [
  "Name",
  "Filiale",
  "Raison sociale",
  "Scénario",
  "Adresse",
  "Date d'inter",
  "Clt VIP",
  "Intervention",
  "Statut",
  "Commentaire",
  "NB DE POSTE",
  "Nom (contact)",
  "Prénom (contact)",
  "Fixe (contact)",
  "Mobile (contact)",
  "Mail (contact)",
  "Techno lien",
  "Débit",
  "Modèle CPE",
  "Postes déployées",
  "LOT",
  "Département",
];

function buildWorkbook(lignes: (string | number | Date | null)[][]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("migration gc");
  ws.addRow(["Migration GC"]);
  ws.addRow(["LOT 1a"]);
  ws.addRow(ENTETES);
  for (const l of lignes) ws.addRow(l);
  return wb;
}

function ligne(
  name: string,
  raisonSociale: string,
  extra: Partial<Record<number, string | number | Date>> = {}
): (string | number | Date | null)[] {
  const base: (string | number | Date | null)[] = new Array(ENTETES.length).fill(null);
  base[0] = name;
  base[2] = raisonSociale;
  for (const [idx, valeur] of Object.entries(extra)) {
    base[Number(idx)] = valeur as string | number | Date;
  }
  return base;
}

describe("normaliserRaisonSociale", () => {
  test("majuscules, espaces réduits, accents conservés", () => {
    expect(normaliserRaisonSociale("  Cabinet   Durand & Associés ")).toBe(
      "CABINET DURAND & ASSOCIÉS"
    );
  });
});

describe("parseMondayWorkbook", () => {
  test("lit les lignes clients avec le lot du groupe courant", () => {
    const wb = buildWorkbook([
      ligne("POCGC025", "AART ELECTRONICS", { 10: 21, 19: "Yealink T57W, Panasonic TGP600" }),
      ligne("POCGC026", "AVA"),
    ]);
    const { lignes, erreurs } = parseMondayWorkbook(wb);
    expect(erreurs).toEqual([]);
    expect(lignes).toHaveLength(2);
    expect(lignes[0].codeMonday).toBe("POCGC025");
    expect(lignes[0].raisonSociale).toBe("AART ELECTRONICS");
    expect(lignes[0].lotNom).toBe("LOT 1a");
    expect(lignes[0].nbPostesAnnonce).toBe(21);
    expect(lignes[0].postesDeployes).toEqual(["Yealink T57W", "Panasonic TGP600"]);
  });

  test("une ligne à cellule unique change le lot des lignes suivantes", () => {
    const wb = buildWorkbook([
      ligne("POCGC025", "AART ELECTRONICS"),
      ["LOT 2", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      ligne("POCGC030", "BOREAL HYGIENE"),
    ]);
    const { lignes } = parseMondayWorkbook(wb);
    expect(lignes[0].lotNom).toBe("LOT 1a");
    expect(lignes[1].lotNom).toBe("LOT 2");
  });

  test("ignore la ligne de totaux (Name vide, NB DE POSTE rempli)", () => {
    const wb = buildWorkbook([
      ligne("POCGC025", "AART ELECTRONICS", { 10: 21 }),
      [null, null, null, null, null, null, null, null, null, null, 21, null, null, null, null, null, null, null, null, null, null, null],
    ]);
    const { lignes } = parseMondayWorkbook(wb);
    expect(lignes).toHaveLength(1);
  });

  test("les dates restent des dates typées", () => {
    const d = new Date("2026-08-15T00:00:00Z");
    const wb = buildWorkbook([ligne("POCGC025", "AART ELECTRONICS", { 5: d })]);
    const { lignes } = parseMondayWorkbook(wb);
    expect(lignes[0].dateIntervention).toEqual(d);
  });
});

describe("rapprocher", () => {
  const existants = [
    { id: "cl1", codeMonday: "POCGC025", raisonSociale: "AART ELECTRONICS" },
    { id: "cl2", codeMonday: null, raisonSociale: "BOREAL HYGIENE" },
    { id: "cl3", codeMonday: null, raisonSociale: "BOREAL  HYGIÈNE SUD" },
  ];

  function l(codeMonday: string | null, raisonSociale: string): MondayLigne {
    return {
      codeMonday,
      raisonSociale,
      lotNom: null,
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
  }

  test("rapproche par codeMonday en priorité", () => {
    const r = rapprocher([l("POCGC025", "AART ELEC RENOMMÉ")], existants, []);
    expect(r.aMettreAJour).toHaveLength(1);
    expect(r.aMettreAJour[0].clientId).toBe("cl1");
    expect(r.aCreer).toHaveLength(0);
  });

  test("rapproche par raison sociale normalisée sinon", () => {
    const r = rapprocher([l(null, " boreal   hygiene ")], existants, []);
    expect(r.aMettreAJour).toHaveLength(1);
    expect(r.aMettreAJour[0].clientId).toBe("cl2");
  });

  test("inconnu → à créer", () => {
    const r = rapprocher([l("POCGC099", "NOUVEAU CLIENT")], existants, []);
    expect(r.aCreer).toHaveLength(1);
  });

  test("modèles inconnus remontés dédoublonnés", () => {
    const ligne1 = l("POCGC099", "NOUVEAU CLIENT");
    ligne1.postesDeployes = ["Yealink T57W", "Grandstream GXP1620", "Grandstream GXP1620"];
    const r = rapprocher([ligne1], existants, ["Yealink T57W"]);
    expect(r.modelesInconnus).toEqual(["Grandstream GXP1620"]);
  });

  test("deux lignes de même raison sociale : la 2e devient un site", () => {
    const paris = l("POCGC300", "CARROSSERIE CDA (78)");
    paris.adresse = "24 BOULEVARD GOUVION SAINT CYR 75017 PARIS";
    const versailles = l("POCGC401", "CARROSSERIE CDA (78)");
    versailles.adresse = "79 RUE DES CHANTIERS 78000 Versailles";

    const r = rapprocher([paris, versailles], existants, []);
    expect(r.aCreer).toHaveLength(1);
    expect(r.sites).toHaveLength(1);
    expect(r.sites[0].motif).toBe("fichier");
    expect(r.sites[0].ligne.adresse).toContain("Versailles");
    expect(r.sites[0].clientId).toBeNull();
  });

  test("client existant à une autre adresse : proposé en site", () => {
    const ligne = l(null, "BOREAL HYGIENE");
    ligne.adresse = "12 RUE NEUVE 49000 ANGERS";
    const avecAdresse = [
      { id: "cl2", codeMonday: null, raisonSociale: "BOREAL HYGIENE", adresse: "1 RUE DU PORT 44000 NANTES" },
    ];
    const r = rapprocher([ligne], avecAdresse, []);
    expect(r.sites).toHaveLength(1);
    expect(r.sites[0].motif).toBe("adresse");
    expect(r.sites[0].clientId).toBe("cl2");
    expect(r.aMettreAJour).toHaveLength(0);
  });

  test("ré-import à la même adresse : simple mise à jour, pas de site", () => {
    const ligne = l(null, "BOREAL HYGIENE");
    ligne.adresse = "1 rue du Port, 44000 NANTES";
    const avecAdresse = [
      { id: "cl2", codeMonday: null, raisonSociale: "BOREAL HYGIENE", adresse: "1 RUE DU PORT 44000 NANTES" },
    ];
    const r = rapprocher([ligne], avecAdresse, []);
    expect(r.sites).toHaveLength(0);
    expect(r.aMettreAJour).toHaveLength(1);
  });

  test("adresse déjà connue comme site : mise à jour, pas de doublon de site", () => {
    const ligne = l(null, "BOREAL HYGIENE");
    ligne.adresse = "12 RUE NEUVE 49000 ANGERS";
    const avecSites = [
      {
        id: "cl2",
        codeMonday: null,
        raisonSociale: "BOREAL HYGIENE",
        adresse: "1 RUE DU PORT 44000 NANTES",
        sites: [{ codeMonday: null, adresse: "12 rue Neuve, 49000 Angers" }],
      },
    ];
    const r = rapprocher([ligne], avecSites, []);
    expect(r.sites).toHaveLength(0);
    expect(r.aMettreAJour).toHaveLength(1);
  });

  test("ré-import : la ligne déjà devenue site n'écrase pas la fiche client", () => {
    const paris = l("POCGC300", "CARROSSERIE CDA (78)");
    paris.adresse = "24 BOULEVARD GOUVION SAINT CYR 75017 PARIS";
    const versailles = l("POCGC401", "CARROSSERIE CDA (78)");
    versailles.adresse = "79 RUE DES CHANTIERS 78000 Versailles";
    // État après un premier import : le client porte Paris, Versailles est un site.
    const apresPremierImport = [
      {
        id: "cl9",
        codeMonday: "POCGC300",
        raisonSociale: "CARROSSERIE CDA (78)",
        adresse: "24 BOULEVARD GOUVION SAINT CYR 75017 PARIS",
        sites: [
          { codeMonday: "POCGC300", adresse: "24 BOULEVARD GOUVION SAINT CYR 75017 PARIS" },
          { codeMonday: "POCGC401", adresse: "79 RUE DES CHANTIERS 78000 Versailles" },
        ],
      },
    ];

    const r = rapprocher([paris, versailles], apresPremierImport, []);
    expect(r.aCreer).toHaveLength(0);
    // Seule la ligne Paris met la fiche client à jour.
    expect(r.aMettreAJour).toHaveLength(1);
    expect(r.aMettreAJour[0].ligne.adresse).toContain("PARIS");
    // Versailles reste un site du même client.
    expect(r.sites).toHaveLength(1);
    expect(r.sites[0].clientId).toBe("cl9");
    expect(r.sites[0].ligne.codeMonday).toBe("POCGC401");
  });
});
