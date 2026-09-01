import { describe, expect, test } from "bun:test";
import { correspond, normaliserRecherche } from "@/components/BarreRecherche";

describe("normaliserRecherche", () => {
  test("ignore casse et accents", () => {
    expect(normaliserRecherche("  Métallerie DÉCO ")).toBe("metallerie deco");
  });
});

describe("correspond", () => {
  const ligne = ["ARDI SAS", "Yealink T54W", "80:5E:0C:D1:A6:4A", "Bruce Wayne"];

  test("recherche vide : tout passe", () => {
    expect(correspond(ligne, "")).toBe(true);
    expect(correspond(ligne, "   ")).toBe(true);
  });

  test("trouve sur n'importe quel champ, casse ignorée", () => {
    expect(correspond(ligne, "ardi")).toBe(true);
    expect(correspond(ligne, "t54w")).toBe(true);
    expect(correspond(ligne, "bruce")).toBe(true);
  });

  test("plusieurs mots : tous doivent être présents, dans n'importe quel ordre", () => {
    expect(correspond(ligne, "ardi t54")).toBe(true);
    expect(correspond(ligne, "t54 ardi")).toBe(true);
    expect(correspond(ligne, "ardi panasonic")).toBe(false);
  });

  test("champs absents ignorés sans planter", () => {
    expect(correspond(["ARDI", null, undefined], "ardi")).toBe(true);
    expect(correspond([null, undefined], "ardi")).toBe(false);
  });

  test("un numéro de série se cherche par fragment", () => {
    expect(correspond(ligne, "d1:a6")).toBe(true);
  });
});
