import { describe, expect, test } from "bun:test";
import { estEquipementReseau } from "./categorieMac";

describe("estEquipementReseau", () => {
  test("téléphones et DECT → téléphonie (false)", () => {
    expect(estEquipementReseau("Yealink", "Yealink T54W")).toBe(false);
    expect(estEquipementReseau("Yealink", "Yealink W90B")).toBe(false);
    expect(estEquipementReseau("Polycom", "Polycom RealPresence Trio 8300")).toBe(false);
    expect(estEquipementReseau("Cisco", "Cisco SPA122")).toBe(false);
  });

  test("switch, routeur, OneAccess, 4G, box → réseau (true)", () => {
    expect(estEquipementReseau("Mikrotik", "Mikrotik_HAPac2")).toBe(true);
    expect(estEquipementReseau("Mikrotik", "Mikrotik ChateauLTE12")).toBe(true);
    expect(estEquipementReseau("Technicolor", "Technicolor TG582n")).toBe(true);
    expect(estEquipementReseau("OneAccess", "OneAccess 1641")).toBe(true);
    expect(estEquipementReseau(null, "Routeur 4G")).toBe(true);
  });

  test("modèle inconnu → téléphonie par défaut (ne perd rien)", () => {
    expect(estEquipementReseau("(modèle inconnu)", "(modèle inconnu)")).toBe(false);
  });
});
