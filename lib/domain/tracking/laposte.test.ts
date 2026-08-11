import { describe, expect, test } from "bun:test";
import {
  etatDeShipment,
  numeroSuiviValide,
  numeroSuiviValidePour,
  transporteurAvecSuiviApi,
  urlSuiviTransporteur,
  type LaPosteTrackingResponse,
} from "./laposte";

describe("numeroSuiviValide", () => {
  test("accepte un numéro Chronopost 13 caractères", () => {
    expect(numeroSuiviValide("XN368574133FR")).toBe(true);
    expect(numeroSuiviValide("8K00009775862")).toBe(true);
  });

  test("refuse trop court, trop long, ou caractères invalides", () => {
    expect(numeroSuiviValide("123")).toBe(false);
    expect(numeroSuiviValide("XN368574133FR0000")).toBe(false);
    expect(numeroSuiviValide("XN3685 4133FR")).toBe(false);
  });

  test("tolère les espaces de bord", () => {
    expect(numeroSuiviValide("  XN368574133FR  ")).toBe(true);
  });
});

describe("etatDeShipment", () => {
  test("colis final avec date de livraison → LIVRE", () => {
    const r: LaPosteTrackingResponse = {
      returnCode: 200,
      shipment: {
        idShip: "XN368574133FR",
        holder: 3,
        product: "Chronopost",
        isFinal: true,
        deliveryDate: "2026-08-05T10:32:00+02:00",
        event: [{ date: "2026-08-05T10:32:00+02:00", label: "Votre colis est livré", code: "DI1" }],
      },
    };
    const e = etatDeShipment(r);
    expect(e.statut).toBe("LIVRE");
    expect(e.livreLe).toBe("2026-08-05T10:32:00+02:00");
    expect(e.libelle).toBe("Votre colis est livré");
  });

  test("colis en transit → EN_COURS, dernier libellé remonté", () => {
    const r: LaPosteTrackingResponse = {
      returnCode: 200,
      shipment: {
        idShip: "XN368574133FR",
        holder: 3,
        product: "Chronopost",
        isFinal: false,
        event: [{ date: "2026-08-04T18:00:00+02:00", label: "Pris en charge par Chronopost", code: "PC1" }],
      },
    };
    const e = etatDeShipment(r);
    expect(e.statut).toBe("EN_COURS");
    expect(e.livreLe).toBeNull();
    expect(e.libelle).toBe("Pris en charge par Chronopost");
  });

  test("numéro inconnu (404) → INCONNU", () => {
    const e = etatDeShipment({ returnCode: 404, returnMessage: "Numéro inconnu" });
    expect(e.statut).toBe("INCONNU");
    expect(e.libelle).toBe("Numéro inconnu");
  });

  test("isFinal sans date de livraison → reste EN_COURS", () => {
    const r: LaPosteTrackingResponse = {
      returnCode: 200,
      shipment: { idShip: "X", holder: 3, product: "Chronopost", isFinal: true, event: [] },
    };
    expect(etatDeShipment(r).statut).toBe("EN_COURS");
  });
});

describe("numeroSuiviValidePour / transporteurAvecSuiviApi", () => {
  test("Chronopost garde la validation stricte 11-15", () => {
    expect(numeroSuiviValidePour("Chronopost", "XN368574133FR")).toBe(true);
    expect(numeroSuiviValidePour("Chronopost", "1234567890")).toBe(false);
  });

  test("DHL accepte les bons courts (10 chiffres) et longs (JJD…)", () => {
    expect(numeroSuiviValidePour("DHL", "1234567890")).toBe(true);
    expect(numeroSuiviValidePour("DHL", "JJD014600002535011186")).toBe(true);
    expect(numeroSuiviValidePour("DHL", "abc")).toBe(false);
  });

  test("seuls La Poste/Chronopost/Colissimo ont le suivi API", () => {
    expect(transporteurAvecSuiviApi("Chronopost")).toBe(true);
    expect(transporteurAvecSuiviApi(null)).toBe(true);
    expect(transporteurAvecSuiviApi("DHL")).toBe(false);
  });

  test("URL de suivi DHL, aucune pour Chronopost (suivi intégré)", () => {
    expect(urlSuiviTransporteur("DHL", "1234567890")).toContain("dhl.com");
    expect(urlSuiviTransporteur("Chronopost", "XN368574133FR")).toBeNull();
  });
});
