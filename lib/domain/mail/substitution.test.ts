import { describe, expect, test } from "bun:test";
import { substituer, VARIABLES_DISPONIBLES } from "./substitution";

describe("substituer", () => {
  test("remplace les variables connues", () => {
    expect(
      substituer("Bonjour {civilite_nom}, RDV le {date}.", {
        civilite_nom: "M. Durand",
        date: "12/08/2026",
      })
    ).toBe("Bonjour M. Durand, RDV le 12/08/2026.");
  });

  test("laisse les variables inconnues telles quelles (pas de trou silencieux)", () => {
    expect(substituer("Objet {nom_client} — {inconnue}", { nom_client: "AART" })).toBe(
      "Objet AART — {inconnue}"
    );
  });

  test("laisse une variable connue mais non fournie telle quelle", () => {
    expect(substituer("Créneau : {creneau}", {})).toBe("Créneau : {creneau}");
  });

  test("remplace toutes les occurrences", () => {
    expect(substituer("{nom_client} / {nom_client}", { nom_client: "X" })).toBe("X / X");
  });

  test("préserve accents et ponctuation", () => {
    expect(substituer("Éléphant {date} — café", { date: "1er août" })).toBe(
      "Éléphant 1er août — café"
    );
  });

  test("la liste des variables disponibles est exposée", () => {
    expect(VARIABLES_DISPONIBLES).toContain("civilite_nom");
    expect(VARIABLES_DISPONIBLES).toContain("numero_gc");
  });
});
