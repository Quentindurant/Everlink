// lib/domain/sync/provisionning.test.ts
import { describe, test, expect } from "bun:test";
import { buildProvisionningRows, PROVISIONNING_HEADERS } from "./provisionning";

describe("buildProvisionningRows", () => {
  test("maps a numero row with equipement and utilisateur", () => {
    const rows = buildProvisionningRows(
      [
        {
          clientRaisonSociale: "ACME SARL",
          numeroBrut: "01 80 87 33 45",
          numerosCourts: ["401", "423"],
          controleNiveau: "OK",
          equipementModeleLibelle: "Yealink T57W",
          equipementMacBrut: "80:5E:0C:53:D6:70",
          utilisateurNom: "BAUDON Émilie",
          hebergeurSource: "SEWAN",
          hebergeurCible: "UNYC",
          statutBascule: "Fait",
          dateBascule: new Date("2026-01-15"),
          commentaire: null,
        },
      ],
      []
    );

    expect(rows).toEqual([
      [
        "ACME SARL",
        "01 80 87 33 45",
        "401/423",
        "OK",
        "Yealink T57W",
        "80:5E:0C:53:D6:70",
        "BAUDON Émilie",
        "SEWAN",
        "UNYC",
        "Fait",
        "2026-01-15",
        "",
      ],
    ]);
  });

  test("appends orphan equipement rows after numero rows, sparse columns", () => {
    const rows = buildProvisionningRows(
      [],
      [
        {
          clientRaisonSociale: "ACME SARL",
          equipementModeleLibelle: "Yealink W90B",
          equipementMacBrut: "030AD2466B",
          commentaire: "Borne DECT accueil",
        },
      ]
    );

    expect(rows).toEqual([
      ["ACME SARL", "", "", "", "Yealink W90B", "030AD2466B", "", "", "", "", "", "Borne DECT accueil"],
    ]);
  });

  test("headers match SPEC.md §3.1 column order", () => {
    expect(PROVISIONNING_HEADERS).toEqual([
      "Client (raison sociale)",
      "Numéro à porter",
      "Numéro court",
      "Contrôle N°",
      "Equipement",
      "Adresse MAC équipement",
      "Utilisateur",
      "Hébergeur source",
      "Hébergeur cible",
      "Bascule des numéros",
      "Date bascule",
      "Commentaires",
    ]);
  });
});
