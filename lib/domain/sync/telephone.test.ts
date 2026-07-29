import { describe, test, expect } from "bun:test";
import { buildTelephoneHeaders, buildTelephoneRows } from "./telephone";

describe("buildTelephoneHeaders", () => {
  test("prefixes the fixed columns before the dynamic step columns", () => {
    expect(buildTelephoneHeaders(["Créer les utilisateurs", "Mettre les équipements"])).toEqual([
      "Client (raison sociale)",
      "Utilisateur",
      "Créer les utilisateurs",
      "Mettre les équipements",
    ]);
  });
});

describe("buildTelephoneRows", () => {
  test("fills known statuts and defaults missing ones to À faire", () => {
    const rows = buildTelephoneRows(
      [
        {
          clientRaisonSociale: "ACME SARL",
          utilisateurNom: "BAUDON Émilie",
          statutsParEtape: { "Créer les utilisateurs": "Fait" },
        },
      ],
      ["Créer les utilisateurs", "Mettre les équipements"]
    );

    expect(rows).toEqual([["ACME SARL", "BAUDON Émilie", "Fait", "À faire"]]);
  });
});
