import { describe, expect, test } from "bun:test";
import { statutLien } from "./statutLien";

describe("statutLien", () => {
  test("livré prime sur commandé", () => {
    expect(statutLien({ lienCommande: true, lienLivre: true })).toBe("LIVRE");
  });

  test("commandé sans livraison", () => {
    expect(statutLien({ lienCommande: true, lienLivre: false })).toBe("COMMANDE");
  });

  test("ni commandé ni livré", () => {
    expect(statutLien({ lienCommande: false, lienLivre: false })).toBe("NON_COMMANDE");
  });

  test("livré sans flag commandé reste livré (cohérence défensive)", () => {
    expect(statutLien({ lienCommande: false, lienLivre: true })).toBe("LIVRE");
  });
});
