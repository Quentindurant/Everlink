import { describe, expect, test } from "bun:test";
import { extraireCodePostal, prefixeSemaine, statutSheetPourEtape } from "./suiviSheet";

describe("statutSheetPourEtape", () => {
  test("traduit les étapes Everlink vers le vocabulaire du Sheet (code couleur ADV)", () => {
    expect(statutSheetPourEtape("À qualifier")).toBe("NEW");
    expect(statutSheetPourEtape("Prévenance envoyée")).toBe("ATT CLIENT");
    expect(statutSheetPourEtape("Contact en cours")).toBe("ATT CLIENT");
    expect(statutSheetPourEtape("Bloqué")).toBe("STAND BY");
    expect(statutSheetPourEtape("RDV planifié")).toBe("INSTALLATION");
    expect(statutSheetPourEtape("Lien livré")).toBe("A SUIVRE");
    expect(statutSheetPourEtape("Bascule faite")).toBe("PORTA");
    expect(statutSheetPourEtape("Post-migration J+7")).toBe("CLOTUREE");
  });

  test("étape inconnue ou absente → NEW", () => {
    expect(statutSheetPourEtape(null)).toBe("NEW");
    expect(statutSheetPourEtape("Étape custom")).toBe("NEW");
  });
});

describe("prefixeSemaine", () => {
  test("semaine ISO de la date d'intervention", () => {
    expect(prefixeSemaine(new Date("2026-08-05"))).toBe("S32 - ");
    expect(prefixeSemaine(new Date("2026-01-01"))).toBe("S1 - ");
  });

  test("sans date → pas de préfixe", () => {
    expect(prefixeSemaine(null)).toBe("");
  });
});

describe("extraireCodePostal", () => {
  test("premier code postal de l'adresse", () => {
    expect(extraireCodePostal("12 rue des Lilas 78570 CHANTELOUP")).toBe("78570");
    expect(extraireCodePostal("93120 LA COURNEUVE")).toBe("93120");
  });

  test("adresse vide ou sans CP → vide", () => {
    expect(extraireCodePostal(null)).toBe("");
    expect(extraireCodePostal("rue sans code")).toBe("");
  });
});
