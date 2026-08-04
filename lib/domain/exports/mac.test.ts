import { describe, test, expect } from "bun:test";
import { buildMacRows, MAC_HEADERS } from "./mac";

describe("buildMacRows", () => {
  test("preserves input order, dedupes by macNormalise within a client", () => {
    const rows = buildMacRows([
      { clientRaisonSociale: "ACME SARL", macBrut: "80:5E:0C:53:D6:70", macNormalise: "805E0C53D670" },
      { clientRaisonSociale: "ACME SARL", macBrut: "80:5e:0c:53:d6:70", macNormalise: "805E0C53D670" },
      { clientRaisonSociale: "ZETA SARL", macBrut: "030AD2466B", macNormalise: "030AD2466B" },
    ]);

    expect(rows).toEqual([
      ["ACME SARL", "80:5E:0C:53:D6:70"],
      ["ZETA SARL", "030AD2466B"],
    ]);
  });

  test("does not dedupe the same MAC across different clients", () => {
    const rows = buildMacRows([
      { clientRaisonSociale: "ACME SARL", macBrut: "030AD2466B", macNormalise: "030AD2466B" },
      { clientRaisonSociale: "ZETA SARL", macBrut: "030AD2466B", macNormalise: "030AD2466B" },
    ]);

    expect(rows).toEqual([
      ["ACME SARL", "030AD2466B"],
      ["ZETA SARL", "030AD2466B"],
    ]);
  });

  test("headers match SPEC.md §6.3", () => {
    expect(MAC_HEADERS).toEqual(["Client (raison sociale)", "Adresse MAC équipement"]);
  });
});

import { buildMacPreviewRows } from "./mac";

test("buildMacPreviewRows: même dédup/ordre, modèle en 3e colonne", () => {
  const rows = buildMacPreviewRows([
    { clientRaisonSociale: "A", macBrut: "80:5E", macNormalise: "805E", modeleLibelle: "Yealink T57W" },
    { clientRaisonSociale: "A", macBrut: "80:5E", macNormalise: "805E", modeleLibelle: "Yealink T57W" },
    { clientRaisonSociale: "A", macBrut: "0291", macNormalise: "0291", modeleLibelle: null },
  ]);
  expect(rows).toEqual([
    ["A", "80:5E", "Yealink T57W"],
    ["A", "0291", ""],
  ]);
});
