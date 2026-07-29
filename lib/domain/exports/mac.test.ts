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

  test("headers match SPEC.md §6.3", () => {
    expect(MAC_HEADERS).toEqual(["Client (raison sociale)", "Adresse MAC équipement"]);
  });
});
