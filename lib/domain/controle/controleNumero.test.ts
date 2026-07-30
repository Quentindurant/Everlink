import { describe, test, expect } from "bun:test";
import { evaluerControle } from "./controleNumero";

describe("evaluerControle", () => {
  test("numéro valide, 10 chiffres commençant par 0, préfixe plausible", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: "u1", numerosCourts: ["401"] },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: ["401"] }
    );
    expect(result).toEqual({ niveau: "OK", detail: null });
  });

  test("numéro pas 10 chiffres après normalisation → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "018087334", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["018087334"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("10 chiffres");
  });

  test("numéro ne commence pas par 0 → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "1180873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["1180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
  });

  test("préfixe 06/07/08 → AVERTISSEMENT, pas bloquant", () => {
    const result = evaluerControle(
      { numeroNormalise: "0680873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["0680873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("préfixe");
  });

  test("doublon de numéro normalisé sur les lots actifs → ERREUR", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: null, numerosCourts: [] },
      { numerosNormalisesActifs: ["0180873345", "0180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("doublon");
  });

  test("utilisateur renseigné sans équipement → AVERTISSEMENT", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: "u1", numerosCourts: [], aEquipement: false },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("cohérence");
  });

  test("équipement renseigné sans utilisateur → AVERTISSEMENT", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: null, numerosCourts: [], aEquipement: true },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("cohérence");
  });

  test("numéro court dupliqué au sein du même client → AVERTISSEMENT", () => {
    const result = evaluerControle(
      { numeroNormalise: "0180873345", utilisateurId: null, numerosCourts: ["401"] },
      { numerosNormalisesActifs: ["0180873345"], numerosCourtsDuClient: ["401", "401"] }
    );
    expect(result.niveau).toBe("AVERTISSEMENT");
    expect(result.detail).toContain("numéro court");
  });

  test("plusieurs anomalies: le niveau le plus sévère gagne, le détail liste tout", () => {
    const result = evaluerControle(
      { numeroNormalise: "0680873345", utilisateurId: null, numerosCourts: [], aEquipement: false },
      { numerosNormalisesActifs: ["0680873345", "0680873345"], numerosCourtsDuClient: [] }
    );
    expect(result.niveau).toBe("ERREUR");
    expect(result.detail).toContain("doublon");
    expect(result.detail).toContain("préfixe");
  });
});
