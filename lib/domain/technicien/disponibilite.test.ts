import { describe, expect, test } from "bun:test";
import {
  techniciensDisponibles,
  memeJour,
  normaliserNomTech,
  nomsTechOccupes,
  type TechnicienLite,
} from "./disponibilite";

const TECHS: TechnicienLite[] = [
  { id: "a", nom: "Bruce", departements: [] },
  { id: "b", nom: "Karim", departements: ["78", "95"] },
  { id: "c", nom: "Fathi", departements: ["44"] },
];

describe("memeJour", () => {
  test("compare à la journée près", () => {
    expect(memeJour(new Date("2026-08-03T09:00:00"), new Date("2026-08-03T18:30:00"))).toBe(true);
    expect(memeJour(new Date("2026-08-03T09:00:00"), new Date("2026-08-04T09:00:00"))).toBe(false);
  });
});

describe("techniciensDisponibles", () => {
  const date = new Date("2026-08-03T00:00:00");

  test("exclut ceux déjà affectés ce jour-là", () => {
    const affectations = [{ technicienId: "a", date: new Date("2026-08-03T14:00:00") }];
    const dispo = techniciensDisponibles(TECHS, affectations, date);
    expect(dispo.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  test("une affectation un autre jour ne bloque pas", () => {
    const affectations = [{ technicienId: "a", date: new Date("2026-08-04T09:00:00") }];
    const dispo = techniciensDisponibles(TECHS, affectations, date);
    expect(dispo.map((t) => t.id)).toContain("a");
  });

  test("filtre par département quand fourni (couvre ou intervient partout)", () => {
    const dispo = techniciensDisponibles(TECHS, [], date, "78");
    // Bruce (partout) + Karim (78,95). Pas Fathi (44).
    expect(dispo.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  test("département inconnu: seuls ceux qui interviennent partout", () => {
    const dispo = techniciensDisponibles(TECHS, [], date, "13");
    expect(dispo.map((t) => t.id)).toEqual(["a"]);
  });

  test("ignore les affectations sans date", () => {
    const affectations = [{ technicienId: "a", date: null }];
    const dispo = techniciensDisponibles(TECHS, affectations, date);
    expect(dispo.map((t) => t.id)).toContain("a");
  });

  test("exclut les noms occupés dans le Zoho Sheet ce jour-là", () => {
    const occupes = new Set(["BRUCE"]); // normalisé
    const dispo = techniciensDisponibles(TECHS, [], date, undefined, occupes);
    expect(dispo.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });
});

describe("normaliserNomTech", () => {
  test("casse, accents, espaces", () => {
    expect(normaliserNomTech("  Jérémy  Chavillon ")).toBe("JEREMY CHAVILLON");
    expect(normaliserNomTech("Bruce ")).toBe("BRUCE");
  });
});

describe("nomsTechOccupes", () => {
  test("matche au jour/mois près (DD/MM et DD/MM/YYYY)", () => {
    const cible = new Date("2026-08-12T00:00:00");
    const aff = [
      { nomTech: "Bruce ", date: "12/08" },
      { nomTech: "Fathi", date: "12/08/2026" },
      { nomTech: "Karim", date: "13/08" },
      { nomTech: "", date: "12/08" },
    ];
    const s = nomsTechOccupes(aff, cible);
    expect([...s].sort()).toEqual(["BRUCE", "FATHI"]);
  });
});
