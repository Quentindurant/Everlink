import { describe, test, expect } from "bun:test";
import { normaliserNumero, normaliserMac } from "./normalisation";

describe("normaliserNumero", () => {
  test("espaces supprimés", () => {
    expect(normaliserNumero("01 80 87 33 45")).toBe("0180873345");
  });
  test("points et tirets supprimés", () => {
    expect(normaliserNumero("01.80-87.33-45")).toBe("0180873345");
  });
  test("+33 converti en 0", () => {
    expect(normaliserNumero("+33180873345")).toBe("0180873345");
  });
  test("tabulation en tête supprimée", () => {
    expect(normaliserNumero("\t0180873345")).toBe("0180873345");
  });
});

describe("normaliserMac", () => {
  test("deux-points supprimés, casse remontée", () => {
    expect(normaliserMac("80:5e:0c:53:d6:70")).toBe("805E0C53D670");
  });
  test("IPUI DECT inchangé hors casse", () => {
    expect(normaliserMac("030ad2466b")).toBe("030AD2466B");
  });
  test("espaces de bord supprimés", () => {
    expect(normaliserMac(" 80:5E:0C:53:D6:70 ")).toBe("805E0C53D670");
  });
});
