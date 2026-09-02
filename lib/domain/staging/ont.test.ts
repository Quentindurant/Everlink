import { describe, expect, test } from "bun:test";
import {
  normaliserNumeroSerie,
  peutEntrerDansLot,
  peutSupprimerOnt,
  valideClotureLot,
  valideSaisieOnt,
} from "./ont";

const aucun = new Map<string, string>();

describe("valideSaisieOnt", () => {
  test("un numéro de série crée l'appareil", () => {
    const r = valideSaisieOnt({ numeroSerie: " ALCL1234ABCD ", raison: "" }, aucun);
    expect(r).toEqual({ ok: true, mode: "numero", numeroSerie: "ALCL1234ABCD" });
  });

  test("une raison seule justifie l'absence d'ONT", () => {
    const r = valideSaisieOnt({ numeroSerie: "", raison: "Pas d'ONT sur place" }, aucun);
    expect(r).toEqual({ ok: true, mode: "absence", raison: "Pas d'ONT sur place" });
  });

  test("rien des deux : l'étape ne peut pas se fermer", () => {
    const r = valideSaisieOnt({ numeroSerie: "  ", raison: " " }, aucun);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/numéro de série|raison/i);
  });

  test("le numéro l'emporte si les deux sont remplis", () => {
    const r = valideSaisieOnt({ numeroSerie: "ALCL1234ABCD", raison: "peu importe" }, aucun);
    expect(r).toEqual({ ok: true, mode: "numero", numeroSerie: "ALCL1234ABCD" });
  });

  test("un numéro déjà attribué est refusé, avec le client qui le détient", () => {
    const existants = new Map([["ALCL1234ABCD", "AQUADOUCE SERVICE"]]);
    const r = valideSaisieOnt({ numeroSerie: "alcl1234abcd", raison: "" }, existants);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("AQUADOUCE SERVICE");
  });

  test("un numéro trop court est refusé : c'est une saisie tronquée", () => {
    const r = valideSaisieOnt({ numeroSerie: "AB12", raison: "" }, aucun);
    expect(r.ok).toBe(false);
  });
});

describe("normaliserNumeroSerie", () => {
  test("majuscules, sans espaces ni tirets", () => {
    expect(normaliserNumeroSerie(" alcl-1234 abcd ")).toBe("ALCL1234ABCD");
  });
});

describe("peutEntrerDansLot", () => {
  test("un ONT reçu et libre entre dans le lot", () => {
    expect(peutEntrerDansLot({ dateReception: new Date(), lotRetourId: null })).toBe(true);
  });

  test("un ONT jamais réceptionné n'entre pas", () => {
    expect(peutEntrerDansLot({ dateReception: null, lotRetourId: null })).toBe(false);
  });

  test("un ONT déjà dans un lot n'entre pas deux fois", () => {
    expect(peutEntrerDansLot({ dateReception: new Date(), lotRetourId: "lot1" })).toBe(false);
  });
});

describe("valideClotureLot", () => {
  const base = {
    nbArticles: 3,
    destinataire: "Grossiste",
    transporteur: "Chronopost",
    numeroSuivi: "XY123456789FR",
  };

  test("un lot complet part", () => {
    expect(valideClotureLot(base)).toEqual({ ok: true });
  });

  test("un lot vide ne part pas", () => {
    const r = valideClotureLot({ ...base, nbArticles: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/vide|aucun/i);
  });

  test("sans destinataire, on ne sait pas où il va", () => {
    expect(valideClotureLot({ ...base, destinataire: " " }).ok).toBe(false);
  });

  test("un numéro Chronopost invalide est refusé", () => {
    expect(valideClotureLot({ ...base, numeroSuivi: "123" }).ok).toBe(false);
  });

  test("DHL accepte ses propres formats de numéro", () => {
    const r = valideClotureLot({ ...base, transporteur: "DHL", numeroSuivi: "JVGL12345678" });
    expect(r).toEqual({ ok: true });
  });
});

describe("peutSupprimerOnt", () => {
  test("un ONT libre se supprime", () => {
    expect(peutSupprimerOnt({ lotRetourId: null })).toBe(true);
  });

  test("un ONT engagé dans un lot ne se supprime pas", () => {
    // Le lot est un carton réel : en retirer un appareil sans le sortir du lot ferait
    // mentir le bordereau remis au grossiste.
    expect(peutSupprimerOnt({ lotRetourId: "lot1" })).toBe(false);
  });
});
