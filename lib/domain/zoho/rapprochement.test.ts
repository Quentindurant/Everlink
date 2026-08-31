import { describe, expect, test } from "bun:test";
import {
  normaliserNomSheet,
  parseDateSheet,
  rapprocherLignes,
  type LigneSheetLite,
} from "./rapprochement";

const ligne = (client: string, installation = "ATT CLIENT"): LigneSheetLite => ({
  client,
  date: "",
  heure: "",
  nomTech: "", nomCp: "",
  installation,
});

describe("normaliserNomSheet", () => {
  test("retire le préfixe semaine et normalise casse/espaces", () => {
    expect(normaliserNomSheet("S31- ART PHOTO LAB")).toBe("ART PHOTO LAB");
    expect(normaliserNomSheet("S27 - AART  ELECTRONICS")).toBe("AART ELECTRONICS");
    expect(normaliserNomSheet("art photo lab ")).toBe("ART PHOTO LAB");
  });
});

describe("rapprocherLignes", () => {
  test("le nom mémorisé (zohoNomSheet) prime, même très différent", () => {
    const r = rapprocherLignes(
      [ligne("S27 - AART ELECTRONICS CHANTELOUP")],
      [{ id: "c1", raisonSociale: "AART ELECTRONICS", zohoNomSheet: "S27 - AART ELECTRONICS CHANTELOUP" }]
    );
    expect(r.apparies).toHaveLength(1);
    expect(r.apparies[0].clientId).toBe("c1");
  });

  test("égalité normalisée : préfixe semaine ignoré", () => {
    const r = rapprocherLignes(
      [ligne("S31- ART PHOTO LAB")],
      [{ id: "c1", raisonSociale: "ART PHOTO LAB", zohoNomSheet: null }]
    );
    expect(r.apparies).toHaveLength(1);
    expect(r.apparies[0].nomSheet).toBe("S31- ART PHOTO LAB");
  });

  test("préfixe unique : suffixe de site toléré", () => {
    const r = rapprocherLignes(
      [ligne("S27 - AART ELECTRONICS CHANTELOUP")],
      [{ id: "c1", raisonSociale: "AART ELECTRONICS", zohoNomSheet: null }]
    );
    expect(r.apparies).toHaveLength(1);
  });

  test("ambigu → jamais synchronisé", () => {
    const r = rapprocherLignes(
      [ligne("S31 - ALLIANZ CABINET SAINT CYR"), ligne("S31- ALLIANZ CABINET BOIS COLOMBES")],
      [{ id: "c1", raisonSociale: "ALLIANZ CABINET", zohoNomSheet: null }]
    );
    expect(r.apparies).toHaveLength(0);
    expect(r.lignesInconnues).toHaveLength(2);
  });

  test("doublon Sheet (ligne re-poussée) : la dernière occurrence gagne", () => {
    const r = rapprocherLignes(
      [ligne("TRIALP", "ATT CLIENT"), ligne("TRIALP", "INSTALLATION")],
      [{ id: "c1", raisonSociale: "TRIALP", zohoNomSheet: null }]
    );
    expect(r.apparies).toHaveLength(1);
    expect(r.apparies[0].ligne.installation).toBe("INSTALLATION");
  });

  test("ligne sans client → inconnue, rien d'inventé", () => {
    const r = rapprocherLignes([ligne("CLIENT HORS EVERLINK")], []);
    expect(r.apparies).toHaveLength(0);
    expect(r.lignesInconnues).toEqual(["CLIENT HORS EVERLINK"]);
  });
});

describe("parseDateSheet", () => {
  test("dd/mm/yyyy → Date UTC", () => {
    const d = parseDateSheet("12/08/2026");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-08-12");
  });
  test("vide ou illisible → null", () => {
    expect(parseDateSheet("")).toBeNull();
    expect(parseDateSheet("demain")).toBeNull();
  });
});
