import { describe, expect, test } from "bun:test";
import { dateOuvertureMigration, etatMigration } from "./migrable";

const maintenant = new Date("2026-09-01T09:00:00Z");
const dans = (jours: number) =>
  new Date(Date.UTC(2026, 8, 1 + jours, 8, 0, 0));

describe("etatMigration", () => {
  test("le statut INSTALLATION ouvre la migration, même sans date", () => {
    const e = etatMigration("INSTALLATION", null, maintenant);
    expect(e.migrable).toBe(true);
    expect(e.raison).toBe("statut_adv");
  });

  test("le statut est comparé sans se soucier de la casse ni des espaces", () => {
    expect(etatMigration(" installation ", null, maintenant).migrable).toBe(true);
  });

  test("les autres statuts n'ouvrent rien par eux-mêmes", () => {
    expect(etatMigration("NEW", null, maintenant).migrable).toBe(false);
    expect(etatMigration("ATT CLIENT", null, maintenant).migrable).toBe(false);
    expect(etatMigration("STAND BY", dans(10), maintenant).migrable).toBe(false);
  });

  test("J-3 ouvre la migration, J-4 pas encore", () => {
    expect(etatMigration(null, dans(3), maintenant).migrable).toBe(true);
    expect(etatMigration(null, dans(3), maintenant).raison).toBe("intervention_proche");
    expect(etatMigration(null, dans(4), maintenant).migrable).toBe(false);
  });

  test("annonce le nombre de jours restants avant l'ouverture", () => {
    expect(etatMigration(null, dans(10), maintenant).joursAvantOuverture).toBe(7);
    expect(etatMigration(null, dans(4), maintenant).joursAvantOuverture).toBe(1);
  });

  test("le jour même et après restent ouverts : le dossier n'est pas fini", () => {
    expect(etatMigration(null, dans(0), maintenant).migrable).toBe(true);
    expect(etatMigration(null, dans(-5), maintenant).migrable).toBe(true);
  });

  test("sans date ni statut, rien ne dit que le dossier est prêt", () => {
    const e = etatMigration(null, null, maintenant);
    expect(e.migrable).toBe(false);
    expect(e.joursAvantOuverture).toBeNull();
  });
});

describe("dateOuvertureMigration", () => {
  test("trois jours avant l'intervention", () => {
    const d = dateOuvertureMigration(new Date(Date.UTC(2026, 8, 10)));
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-07");
  });

  test("sans intervention, pas de date d'ouverture", () => {
    expect(dateOuvertureMigration(null)).toBeNull();
  });
});
