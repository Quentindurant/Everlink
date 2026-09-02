import { describe, expect, test } from "bun:test";
import {
  etapeColis,
  etatDeShipment,
  LIBELLES_ETAPE_COLIS,
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

describe("etapeColis", () => {
  const rep = (shipment: unknown) =>
    ({ returnCode: 200, shipment } as LaPosteTrackingResponse);

  test("suivi introuvable : on sait seulement que le colis est parti", () => {
    expect(etapeColis({ returnCode: 404 })).toBe(1);
    expect(etapeColis({ returnCode: 200 })).toBe(1);
  });

  test("colis connu mais sans prise en charge ni événement", () => {
    expect(etapeColis(rep({ idShip: "X", holder: 3, product: "chrono", isFinal: false }))).toBe(1);
  });

  test("entryDate seule : pris en charge", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("un événement postérieur à la prise en charge : en transit", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-02T06:30:00+02:00", label: "En cours d'acheminement", code: "AG1" }],
    });
    expect(etapeColis(r)).toBe(3);
  });

  test("l'événement de prise en charge lui-même ne fait pas un transit", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-01T08:00:00+02:00", label: "Pris en charge", code: "PC1" }],
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("livré : isFinal et deliveryDate ensemble", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: true,
      entryDate: "2026-09-01T08:00:00+02:00",
      deliveryDate: "2026-09-03T10:12:00+02:00",
      event: [{ date: "2026-09-03T10:12:00+02:00", label: "Votre colis est livré", code: "DI1" }],
    });
    expect(etapeColis(r)).toBe(4);
  });

  test("isFinal sans date de livraison ne vaut pas livraison", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: true,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-02T09:00:00+02:00", label: "Retour expéditeur", code: "RE1" }],
    });
    expect(etapeColis(r)).toBe(3);
  });

  test("des événements sans entryDate valent prise en charge", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      event: [{ date: "2026-09-02T09:00:00+02:00", label: "Traitement", code: "TR1" }],
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("les quatre étapes ont un libellé", () => {
    expect(Object.keys(LIBELLES_ETAPE_COLIS)).toHaveLength(4);
    expect(LIBELLES_ETAPE_COLIS[4]).toBe("Livré");
  });
});

describe("etatDeShipment porte l'étape", () => {
  test("un colis livré rapporte l'étape 4", () => {
    const etat = etatDeShipment({
      returnCode: 200,
      shipment: {
        idShip: "X", holder: 3, product: "chrono", isFinal: true,
        entryDate: "2026-09-01T08:00:00+02:00",
        deliveryDate: "2026-09-03T10:12:00+02:00",
        event: [{ date: "2026-09-03T10:12:00+02:00", label: "Livré", code: "DI1" }],
      },
    });
    expect(etat.etape).toBe(4);
  });

  test("un suivi introuvable rapporte l'étape 1", () => {
    expect(etatDeShipment({ returnCode: 404 }).etape).toBe(1);
  });
});
