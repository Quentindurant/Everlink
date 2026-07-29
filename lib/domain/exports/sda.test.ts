import { describe, test, expect } from "bun:test";
import { buildSdaRows, SDA_HEADERS } from "./sda";

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
