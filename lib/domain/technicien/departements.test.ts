import { describe, expect, test } from "bun:test";
import { extraireDepartements } from "./departements";

describe("extraireDepartements", () => {
  test("liste séparée par virgules", () => {
    expect(extraireDepartements("54, 55, 57, 88,")).toEqual(["54", "55", "57", "88"]);
  });

  test("code postal → deux premiers chiffres", () => {
    expect(extraireDepartements("74100 Annemasse")).toEqual(["74"]);
    expect(extraireDepartements("75018\nParis")).toEqual(["75"]);
  });

  test("liste avec tirets", () => {
    expect(extraireDepartements("75-77-78-91-92-93-94-95")).toEqual([
      "75", "77", "78", "91", "92", "93", "94", "95",
    ]);
  });

  test("texte parasite autour d'un département", () => {
    expect(extraireDepartements("Viens du déartement 62")).toEqual(["62"]);
  });

  test("dédoublonne et ignore le vide", () => {
    expect(extraireDepartements("42, 42, 69")).toEqual(["42", "69"]);
    expect(extraireDepartements("")).toEqual([]);
    expect(extraireDepartements("aucune zone")).toEqual([]);
  });

  test("code corse et 3 chiffres ignorés au-delà de 95", () => {
    // On garde 2A/2B non gérés (rare); les nombres > 95 hors code postal sont ignorés.
    expect(extraireDepartements("Installation 100 postes en 78")).toEqual(["78"]);
  });
});
