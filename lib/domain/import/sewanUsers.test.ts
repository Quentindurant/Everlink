import { describe, expect, test } from "bun:test";
import { parseSewanUsers } from "./sewanUsers";

const HEADER =
  '"Nom";"Prénom";"Numéro(s)";"Numéro(s) Interne(s)";"Equipement(s)";"Service(s)";"Identifiant/Email";"Password";"Contact mail";"Mobile";"Mobile abrégés";"Numéro Affiché (NDS)";';

describe("parseSewanUsers", () => {
  test("parse une ligne standard", () => {
    const csv = [
      HEADER,
      '"ALBOU";"Alain";"\'+33134083932 (Pack téléphonie hébergée)";"\'432";"Yealink T54W (44:DB:D2:5B:C1:56)";"Pack téléphonie hébergée";"aalbou@x.eu";"********";"alain.albou@x.com";"\'";"\'";"\'+33134083932";',
    ].join("\n");
    const { rows, ignores } = parseSewanUsers(csv);
    expect(ignores).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      nom: "ALBOU Alain",
      numeroBrut: "0134083932",
      numeroInterne: "432",
      equipements: [{ modele: "Yealink T54W", mac: "44:DB:D2:5B:C1:56" }],
      email: "alain.albou@x.com",
    });
  });

  test("utilisateur avec deux postes → deux équipements distincts", () => {
    const csv = [
      HEADER,
      '"AFPI";"78";"\'+33134080000 (Pack)";"\'450";"Yealink T54W (80:5E:0C:D1:A6:4A), Yealink T54W";"Pack";"a@x";"*";"";"\'";"\'";"";',
    ].join("\n");
    const { rows } = parseSewanUsers(csv);
    expect(rows[0].equipements).toEqual([
      { modele: "Yealink T54W", mac: "80:5E:0C:D1:A6:4A" },
      { modele: "Yealink T54W", mac: null },
    ]);
  });

  test("ignore les lignes sans numéro (infra / user sans ligne)", () => {
    const csv = [
      HEADER,
      '"4G";"Routeur";"";"";"";"";"r4g@x";"********";"None";"\'";"\'";"";',
      '"BARROUL";"Bruno";"";"";"";"Administration";"bruno@x.com";"********";"bruno@x.com";"\'";"\'";"";',
    ].join("\n");
    const { rows, ignores } = parseSewanUsers(csv);
    expect(rows).toHaveLength(0);
    expect(ignores).toBe(2);
  });

  test("équipement sans MAC reconnaissable → modèle sans mac", () => {
    const csv = [
      HEADER,
      '"X";"Y";"\'+33100000000 (Pack)";"\'400";"DOKO";"Pack";"x@x";"*";"x@x";"\'";"\'";"";',
    ].join("\n");
    const { rows } = parseSewanUsers(csv);
    expect(rows[0].equipements).toEqual([{ modele: "DOKO", mac: null }]);
  });

  test("Polycom avec MAC", () => {
    const csv = [
      HEADER,
      '"CONFERENCE";"BAS";"\'+33134087231 (Pack)";"\'431";"Polycom RealPresence Trio 8300 (64:16:7F:4E:6B:37)";"Pack";"c@x";"*";"";"\'";"\'";"";',
    ].join("\n");
    const { rows } = parseSewanUsers(csv);
    expect(rows[0].nom).toBe("CONFERENCE BAS");
    expect(rows[0].equipements).toEqual([
      { modele: "Polycom RealPresence Trio 8300", mac: "64:16:7F:4E:6B:37" },
    ]);
  });

  test("IPUI DECT suffixé de la marque → identifiant seul (tiret ou demi-cadratin)", () => {
    const csv = [
      HEADER,
      '"DECT";"UN";"\'+33134080001 (Pack)";"\'451";"Yealink W59R (0291EE3BBA - YEALINK), Yealink T53 (80:5E:0C:C7:39:51)";"Pack";"d@x";"*";"";"\'";"\'";"";',
      '"DECT";"DEUX";"\'+33134080002 (Pack)";"\'452";"Yealink W59R (0291EE3460 – YEALINK)";"Pack";"e@x";"*";"";"\'";"\'";"";',
    ].join("\n");
    const { rows } = parseSewanUsers(csv);
    expect(rows[0].equipements).toEqual([
      { modele: "Yealink W59R", mac: "0291EE3BBA" },
      { modele: "Yealink T53", mac: "80:5E:0C:C7:39:51" },
    ]);
    expect(rows[1].equipements).toEqual([{ modele: "Yealink W59R", mac: "0291EE3460" }]);
  });
});
