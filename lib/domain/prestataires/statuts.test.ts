import { describe, expect, test } from "bun:test";
import {
  doitAlerterChefProjet,
  estPrestataireTraite,
  joursAvant,
  niveauPrestataire,
} from "./statuts";

describe("estPrestataireTraite", () => {
  test("joint ou écarté = traité ; à contacter ou injoignable = non", () => {
    expect(estPrestataireTraite("CONTACTE")).toBe(true);
    expect(estPrestataireTraite("SANS_OBJET")).toBe(true);
    expect(estPrestataireTraite("A_CONTACTER")).toBe(false);
    // Injoignable n'est pas un aboutissement : c'est le cas qui fait échouer le jour J.
    expect(estPrestataireTraite("INJOIGNABLE")).toBe(false);
  });
});

describe("niveauPrestataire", () => {
  test("trois niveaux d'affichage", () => {
    expect(niveauPrestataire("CONTACTE")).toBe("ok");
    expect(niveauPrestataire("SANS_OBJET")).toBe("ok");
    expect(niveauPrestataire("A_CONTACTER")).toBe("attente");
    expect(niveauPrestataire("INJOIGNABLE")).toBe("alerte");
  });
});

describe("joursAvant", () => {
  test("compte des jours pleins, insensible à l'heure", () => {
    // Cron lancé tard le soir, intervention tôt le matin trois jours plus tard.
    expect(joursAvant(new Date("2026-09-04T08:00:00Z"), new Date("2026-09-01T23:30:00Z"))).toBe(3);
    expect(joursAvant(new Date("2026-09-01T08:00:00Z"), new Date("2026-09-01T23:30:00Z"))).toBe(0);
    expect(joursAvant(new Date("2026-08-30T08:00:00Z"), new Date("2026-09-01T09:00:00Z"))).toBe(-2);
  });
});

describe("doitAlerterChefProjet", () => {
  const maintenant = new Date("2026-09-01T09:00:00Z");
  const dans3j = new Date("2026-09-04T08:00:00Z");
  const dans10j = new Date("2026-09-11T08:00:00Z");

  test("alerte à J-3 quand un prestataire n'est pas traité", () => {
    expect(doitAlerterChefProjet(dans3j, ["A_CONTACTER"], maintenant)).toBe(true);
    expect(doitAlerterChefProjet(dans3j, ["CONTACTE", "INJOIGNABLE"], maintenant)).toBe(true);
  });

  test("pas d'alerte si tous les prestataires sont traités", () => {
    expect(doitAlerterChefProjet(dans3j, ["CONTACTE", "SANS_OBJET"], maintenant)).toBe(false);
  });

  test("pas d'alerte trop tôt, ni après l'intervention", () => {
    expect(doitAlerterChefProjet(dans10j, ["A_CONTACTER"], maintenant)).toBe(false);
    const hier = new Date("2026-08-31T08:00:00Z");
    expect(doitAlerterChefProjet(hier, ["A_CONTACTER"], maintenant)).toBe(false);
  });

  test("le jour même compte encore : il reste des heures pour rattraper", () => {
    const aujourdhui = new Date("2026-09-01T16:00:00Z");
    expect(doitAlerterChefProjet(aujourdhui, ["A_CONTACTER"], maintenant)).toBe(true);
  });

  test("sans date d'intervention ou sans prestataire, rien à signaler", () => {
    expect(doitAlerterChefProjet(null, ["A_CONTACTER"], maintenant)).toBe(false);
    expect(doitAlerterChefProjet(dans3j, [], maintenant)).toBe(false);
  });
});
