import { describe, expect, test } from "bun:test";
import {
  doitSuggererBloque,
  estBasculee,
  SEUIL_TENTATIVES,
  type EtapeMigrationLite,
} from "./etapes";

const ETAPES: EtapeMigrationLite[] = [
  { id: "a", libelle: "À qualifier", ordre: 0, couleur: "#98a2b3", estBloquant: false },
  { id: "b", libelle: "Prévenance envoyée", ordre: 1, couleur: "#1f6bff", estBloquant: false },
  { id: "c", libelle: "Contact en cours", ordre: 2, couleur: "#00b8cc", estBloquant: false },
  { id: "d", libelle: "Bloqué", ordre: 3, couleur: "#f04438", estBloquant: true },
  { id: "e", libelle: "RDV planifié", ordre: 4, couleur: "#8a5bff", estBloquant: false },
  { id: "f", libelle: "Lien livré", ordre: 5, couleur: "#ffb020", estBloquant: false },
  { id: "g", libelle: "Bascule faite", ordre: 6, couleur: "#16b57f", estBloquant: false },
  { id: "h", libelle: "Post-migration J+7", ordre: 7, couleur: "#0e7a56", estBloquant: false },
];

const byId = (id: string) => ETAPES.find((e) => e.id === id)!;

describe("estBasculee", () => {
  test("faux avant l'étape terminale", () => {
    expect(estBasculee(byId("e"), ETAPES)).toBe(false); // RDV planifié
    expect(estBasculee(byId("d"), ETAPES)).toBe(false); // Bloqué
    expect(estBasculee(null, ETAPES)).toBe(false);
  });

  test("vrai à partir de Bascule faite", () => {
    expect(estBasculee(byId("g"), ETAPES)).toBe(true); // Bascule faite
    expect(estBasculee(byId("h"), ETAPES)).toBe(true); // Post-migration
  });

  test("faux si l'étape terminale n'existe pas dans le référentiel", () => {
    const sansTerminale = ETAPES.filter((e) => e.libelle !== "Bascule faite");
    expect(estBasculee(byId("h"), sansTerminale)).toBe(false);
  });
});

describe("doitSuggererBloque", () => {
  test("faux sous le seuil", () => {
    expect(doitSuggererBloque(SEUIL_TENTATIVES - 1, byId("c"))).toBe(false);
  });

  test("vrai au seuil, étape non bloquante ni terminale", () => {
    expect(doitSuggererBloque(SEUIL_TENTATIVES, byId("c"))).toBe(true);
  });

  test("faux si déjà Bloqué", () => {
    expect(doitSuggererBloque(SEUIL_TENTATIVES + 2, byId("d"))).toBe(false);
  });

  test("faux si déjà basculé (inutile de bloquer)", () => {
    expect(doitSuggererBloque(SEUIL_TENTATIVES + 2, byId("g"))).toBe(false);
  });
});
