import { describe, expect, test } from "bun:test";
import { estSim, operateurSim } from "./sim";

describe("operateurSim", () => {
  test("un ICCID français Orange", () => {
    // Exemple relevé en stock.
    expect(operateurSim("8933011458868580623")?.nom).toBe("Orange");
  });

  test("un numéro Bouygues au format court", () => {
    // Bouygues ne fournit pas d'ICCID sur ces cartes : treize chiffres commençant par 27.
    expect(operateurSim("2724201638892")?.nom).toBe("Bouygues");
  });

  test("les autres émetteurs français sont reconnus", () => {
    expect(operateurSim("8933071234567890123")?.nom).toBe("Bouygues");
    expect(operateurSim("8933201234567890123")?.nom).toBe("SFR");
    expect(operateurSim("8933151234567890123")?.nom).toBe("Free");
  });

  test("espaces et tirets de l'étiquette n'empêchent pas la lecture", () => {
    expect(operateurSim(" 8933 01 1458 8685 806 23 ")?.nom).toBe("Orange");
  });

  test("un numéro non reconnu ne prétend pas l'être", () => {
    // Mieux vaut ne rien affirmer qu'afficher un mauvais opérateur sur une carte.
    expect(operateurSim("1234567890")).toBeNull();
    expect(operateurSim("")).toBeNull();
    expect(operateurSim("8933991234567890123")).toBeNull();
  });

  test("chaque opérateur a sa teinte, pour la distinguer d'un coup d'œil", () => {
    expect(operateurSim("8933011458868580623")?.pal).toBe("amber");
    expect(operateurSim("2724201638892")?.pal).toBe("blue");
  });
});

describe("estSim", () => {
  test("reconnaît le type SIM quelle que soit la casse", () => {
    expect(estSim("SIM")).toBe(true);
    expect(estSim("sim")).toBe(true);
    expect(estSim("Carte SIM")).toBe(true);
  });

  test("un routeur n'est pas une SIM", () => {
    expect(estSim("Chateau LTE12 Mikrotik")).toBe(false);
    expect(estSim("ONT")).toBe(false);
  });
});
