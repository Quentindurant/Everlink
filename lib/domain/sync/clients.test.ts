import { describe, test, expect } from "bun:test";
import { buildClientsRows, CLIENTS_HEADERS } from "./clients";

describe("buildClientsRows", () => {
  test("maps a client row with computed counts", () => {
    const rows = buildClientsRows([
      {
        raisonSociale: "ACME SARL",
        lotNom: "LOT 1a",
        nbNumeros: 21,
        nbMacSaisis: 23,
        nbMacDistincts: 22,
        nbBasculesFaites: 5,
        statutGlobal: "En cours",
        scenario: "Migration",
        adresse: "1 rue de Paris",
        contactNom: "MARTIN",
        contactPrenom: "Jean",
        nbPostesAnnonce: 20,
        nbEquipements: 22,
      },
    ]);

    expect(rows).toEqual([
      [
        "ACME SARL",
        "LOT 1a",
        "21",
        "23",
        "22",
        "5",
        "En cours",
        "Migration",
        "1 rue de Paris",
        "MARTIN Jean",
        "20",
        "-2",
      ],
    ]);
  });

  test("blanks out missing optional fields", () => {
    const rows = buildClientsRows([
      {
        raisonSociale: "SZUMNY GABRIEL PERI",
        lotNom: null,
        nbNumeros: 0,
        nbMacSaisis: 0,
        nbMacDistincts: 0,
        nbBasculesFaites: 0,
        statutGlobal: "À faire",
        scenario: null,
        adresse: null,
        contactNom: null,
        contactPrenom: null,
        nbPostesAnnonce: null,
        nbEquipements: 0,
      },
    ]);

    expect(rows).toEqual([
      ["SZUMNY GABRIEL PERI", "", "0", "0", "0", "0", "À faire", "", "", "", "", ""],
    ]);
  });

  test("headers match SPEC.md §3.2 column order", () => {
    expect(CLIENTS_HEADERS).toEqual([
      "Raison sociale",
      "Lot",
      "Nb numéros",
      "MAC saisis",
      "MAC distincts",
      "Bascules faites",
      "Statut global",
      "Scénario",
      "Adresse",
      "Contact",
      "Nb postes annoncé (Monday)",
      "Écart postes/équipements",
    ]);
  });
});
