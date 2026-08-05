import { describe, test, expect } from "bun:test";
import { buildSdaRows, motifExclusionNumero, SDA_HEADERS } from "./sda";

describe("buildSdaRows", () => {
  test("trusts input order — ordering is the repository's SQL orderBy responsibility, not this function's", () => {
    const rows = buildSdaRows([
      { clientRaisonSociale: "ACME SARL", numeroBrut: "0102030407", ordre: 0 },
      { clientRaisonSociale: "ACME SARL", numeroBrut: "0102030406", ordre: 1 },
      { clientRaisonSociale: "ZETA SARL", numeroBrut: "0102030405", ordre: 0 },
    ]);

    expect(rows).toEqual([
      ["ACME SARL", "0102030407"],
      ["ACME SARL", "0102030406"],
      ["ZETA SARL", "0102030405"],
    ]);
  });

  test("headers match SPEC.md §6.2", () => {
    expect(SDA_HEADERS).toEqual(["Client (raison sociale)", "Numéro à porter"]);
  });
});

describe("motifExclusionNumero", () => {
  test("numéro fixe 10 chiffres → éligible", () => {
    expect(motifExclusionNumero("0450123456")).toBeNull();
    expect(motifExclusionNumero("0102030405")).toBeNull();
    expect(motifExclusionNumero("0987654321")).toBeNull();
  });

  test("mobile 06/07 → écarté", () => {
    expect(motifExclusionNumero("0612345678")).toBe("numéro mobile");
    expect(motifExclusionNumero("0712345678")).toBe("numéro mobile");
  });

  test("numéro de SIM (plus de 10 chiffres) → écarté", () => {
    expect(motifExclusionNumero("07000008947698")).toBe("numéro SIM");
  });

  test("le zéro initial et les séparateurs éventuels n'affectent pas la détection", () => {
    expect(motifExclusionNumero("06 12 34 56 78")).toBe("numéro mobile");
    expect(motifExclusionNumero("04 50 12 34 56")).toBeNull();
  });

  test("numéro court interne (moins de 10 chiffres) → éligible, pas un mobile ni une SIM", () => {
    expect(motifExclusionNumero("432")).toBeNull();
  });
});
