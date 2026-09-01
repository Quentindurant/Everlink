import { describe, expect, test } from "bun:test";
import {
  macPourAutoprovision,
  modelePourAutoprovision,
  urlAutoprovision,
} from "./autoprovision";

describe("modelePourAutoprovision", () => {
  test("retire la marque et met en majuscules", () => {
    expect(modelePourAutoprovision("Yealink T54W")).toBe("T54W");
    expect(modelePourAutoprovision("Panasonic TGP600")).toBe("TGP600");
    expect(modelePourAutoprovision("Yealink W90B Satellite")).toBe("W90BSATELLITE");
  });

  test("un libellé sans marque reste intact", () => {
    expect(modelePourAutoprovision("T57W")).toBe("T57W");
  });

  test("libellé vide : rien à construire", () => {
    expect(modelePourAutoprovision("  ")).toBe("");
  });
});

describe("macPourAutoprovision", () => {
  test("accepte les deux écritures rencontrées à l'import", () => {
    expect(macPourAutoprovision("80:5E:0C:D1:A6:4A")).toBe("805E0CD1A64A");
    expect(macPourAutoprovision("805e0cd1a64a")).toBe("805E0CD1A64A");
  });
});

describe("urlAutoprovision", () => {
  test("Panasonic : chaque poste a son fichier de configuration", () => {
    expect(urlAutoprovision("Panasonic", "Panasonic TGP600", "4C:36:4E:5B:8E:A4")).toBe(
      "https://titan.eqinoxe.com/sip-ps/TGP600-4C364E5B8EA4.cfg"
    );
  });

  test("les autres marques n'ont pas d'URL personnalisée", () => {
    // Un Yealink s'autoprovisionne par l'URL générique du serveur : lui fabriquer un lien
    // par poste serait faux, c'était le bug signalé.
    expect(urlAutoprovision("Yealink", "Yealink T54W", "80:5E:0C:D1:A6:4A")).toBeNull();
    expect(urlAutoprovision(null, "T54W", "805E0CD1A64A")).toBeNull();
  });

  test("Panasonic sans MAC exploitable : pas d'URL", () => {
    expect(urlAutoprovision("Panasonic", "Panasonic TGP600", "")).toBeNull();
    expect(urlAutoprovision("Panasonic", "Panasonic TGP600", null)).toBeNull();
  });
});
