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
  test("construit l'URL du fichier de configuration", () => {
    expect(urlAutoprovision("Yealink T54W", "80:5E:0C:D1:A6:4A")).toBe(
      "https://titan.eqinoxe.com/sip-ps/T54W-805E0CD1A64A.cfg"
    );
  });

  test("sans MAC exploitable, pas d'URL : un softphone n'a pas de fichier", () => {
    expect(urlAutoprovision("DOKO", "")).toBeNull();
    expect(urlAutoprovision("Yealink T54W", null)).toBeNull();
    // Identifiant DECT (10 caractères) : ce n'est pas une MAC de 12.
    expect(urlAutoprovision("Yealink W73H", "0291EBE5EF")).toBeNull();
  });

  test("sans modèle, pas d'URL", () => {
    expect(urlAutoprovision(null, "805E0CD1A64A")).toBeNull();
  });
});
