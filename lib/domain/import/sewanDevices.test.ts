import { describe, expect, test } from "bun:test";
import { parseSewanDevices } from "./sewanDevices";

const HEADER =
  'Modèle;Identifiant;"N° de série";"Nb Ports";Label;Propriétaire;Utilisateur;"Date de début de location";"Date de fin d\'engagement"';

describe("parseSewanDevices", () => {
  test("parse une ligne standard (MAC hex sans séparateur)", () => {
    const csv = [HEADER, '"Yealink T57W";805E0C5D0B2E;;1;;afdaeim.esat;standa@x.eu;;'].join("\n");
    const { rows, ignores } = parseSewanDevices(csv);
    expect(ignores).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      modele: "Yealink T57W",
      mac: "805E0C5D0B2E",
      utilisateurSewan: "standa@x.eu",
    });
  });

  test("identifiant IPUI avec suffixe ' - YEALINK' → IPUI seul", () => {
    const csv = [HEADER, '"Yealink W59R";"0291EE3460 - YEALINK";0291EE3460;1;;prop;;;'].join("\n");
    const { rows } = parseSewanDevices(csv);
    expect(rows[0].mac).toBe("0291EE3460");
    expect(rows[0].modele).toBe("Yealink W59R");
  });

  test("sans utilisateur → utilisateurSewan null", () => {
    const csv = [HEADER, '"Yealink W90DM";805E0C16A806;;250;;prop;;;'].join("\n");
    const { rows } = parseSewanDevices(csv);
    expect(rows[0].utilisateurSewan).toBeNull();
  });

  test("ligne sans identifiant ignorée", () => {
    const csv = [HEADER, '"Yealink T53";;;1;;prop;;;'].join("\n");
    const { rows, ignores } = parseSewanDevices(csv);
    expect(rows).toHaveLength(0);
    expect(ignores).toBe(1);
  });
});
