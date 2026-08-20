import { describe, expect, test } from "bun:test";
import {
  estNomPlausible,
  nomDejaDansChoix,
  techniciensManquantsDuReferentiel,
} from "./referentielTechniciens";

describe("estNomPlausible", () => {
  test("écarte les cases de service et saisies parasites", () => {
    for (const brut of ["/", "-", "--", "…", "A", "D2", "  ", ""]) {
      expect(estNomPlausible(brut)).toBe(false);
    }
  });

  test("accepte un nom réel, accentué ou composé", () => {
    for (const brut of ["Bruce", "jérôme", "JEAN-PIERRE", " Aït "]) {
      expect(estNomPlausible(brut)).toBe(true);
    }
  });
});

describe("nomDejaDansChoix", () => {
  const labels = ["BRUCE", "Jérôme", "Jean  Pierre"];

  test("détecte le nom malgré casse, espaces et accents", () => {
    expect(nomDejaDansChoix(labels, "bruce")).toBe(true);
    expect(nomDejaDansChoix(labels, "  BRUCE  ")).toBe(true);
    expect(nomDejaDansChoix(labels, "JEROME")).toBe(true);
    expect(nomDejaDansChoix(labels, "jean pierre")).toBe(true);
  });

  test("absent de la liste ou nom vide : false", () => {
    expect(nomDejaDansChoix(labels, "Marc")).toBe(false);
    expect(nomDejaDansChoix(labels, "   ")).toBe(false);
    expect(nomDejaDansChoix([], "Bruce")).toBe(false);
  });
});

describe("techniciensManquantsDuReferentiel", () => {
  test("retient les plausibles absents, en gardant le libellé d'origine", () => {
    const manquants = techniciensManquantsDuReferentiel(
      ["Bruce", "Jérôme", "/", "-", "Marc"],
      ["BRUCE"]
    );
    expect(manquants).toEqual(["Jérôme", "Marc"]);
  });

  test("dédoublonne le référentiel lui-même (casse/espaces/accents)", () => {
    expect(techniciensManquantsDuReferentiel(["Bruce", "BRUCE", "  bruce "], [])).toEqual(["Bruce"]);
    expect(techniciensManquantsDuReferentiel(["Jerome"], ["Jérôme"])).toEqual([]);
  });

  test("référentiel vide : rien à créer", () => {
    expect(techniciensManquantsDuReferentiel([], ["Bruce"])).toEqual([]);
  });
});
