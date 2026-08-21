import { describe, expect, test } from "bun:test";
import type { SuiviColumn } from "./suiviClient";
import { ajouterTechAuReferentiel, lireLabelsReferentiel } from "./referentielTechniciens";

// --- Outillage : faux client suivi (lecture des colonnes + ajout de choix) ---

function fauxClient(colonnes: SuiviColumn[] | Error, opts: { ajoutEchoue?: boolean } = {}) {
  const ajouts: { columnId: string; label: string }[] = [];
  let lectures = 0;
  const client = {
    lireColonnes: async (): Promise<SuiviColumn[]> => {
      lectures++;
      if (colonnes instanceof Error) throw colonnes;
      return colonnes;
    },
    ajouterChoix: async (columnId: string, label: string): Promise<void> => {
      if (opts.ajoutEchoue) throw new Error("réseau coupé");
      ajouts.push({ columnId, label });
    },
  };
  return { client, ajouts, nbLectures: () => lectures };
}

const colonneTech = (surcharges: Partial<SuiviColumn> = {}): SuiviColumn => ({
  id: "c-tech",
  key: "nom_tech",
  label: "NOM TECH",
  type: "SELECT",
  choices: [],
  ...surcharges,
});

const choix = (label: string, archived = false) => ({ id: `ch-${label}`, label, archived });

// --- Push : inscription du technicien dans le référentiel --------------------

describe("ajouterTechAuReferentiel — push", () => {
  test("ajoute le technicien absent de la liste (libellé trimé)", async () => {
    const { client, ajouts } = fauxClient([colonneTech({ choices: [choix("BRUCE")] })]);
    const ajoute = await ajouterTechAuReferentiel(client, " Marc ");
    expect(ajoute).toBe(true);
    expect(ajouts).toEqual([{ columnId: "c-tech", label: "Marc" }]);
  });

  test("déjà présent (casse/espaces différents) : aucun ajout", async () => {
    const { client, ajouts } = fauxClient([colonneTech({ choices: [choix("BRUCE")] })]);
    expect(await ajouterTechAuReferentiel(client, "  bruce ")).toBe(false);
    expect(ajouts).toHaveLength(0);
  });

  test("présent mais archivé : aucun ajout (sinon 422 doublon à chaque push)", async () => {
    const { client, ajouts } = fauxClient([colonneTech({ choices: [choix("BRUCE", true)] })]);
    expect(await ajouterTechAuReferentiel(client, "Bruce")).toBe(false);
    expect(ajouts).toHaveLength(0);
  });

  test("nom vide ou absent : aucun appel réseau", async () => {
    const { client, ajouts, nbLectures } = fauxClient([colonneTech()]);
    expect(await ajouterTechAuReferentiel(client, "")).toBe(false);
    expect(await ajouterTechAuReferentiel(client, "   ")).toBe(false);
    expect(await ajouterTechAuReferentiel(client, null)).toBe(false);
    expect(await ajouterTechAuReferentiel(client, undefined)).toBe(false);
    expect(nbLectures()).toBe(0);
    expect(ajouts).toHaveLength(0);
  });

  test("colonne encore TEXT (transition en prod) : aucun ajout, pas d'échec", async () => {
    const { client, ajouts } = fauxClient([colonneTech({ type: "TEXT" })]);
    expect(await ajouterTechAuReferentiel(client, "Marc")).toBe(false);
    expect(ajouts).toHaveLength(0);
  });

  test("colonne nom_tech absente : aucun ajout, pas d'échec", async () => {
    const { client, ajouts } = fauxClient([colonneTech({ key: "statut" })]);
    expect(await ajouterTechAuReferentiel(client, "Marc")).toBe(false);
    expect(ajouts).toHaveLength(0);
  });

  test("lecture des colonnes en échec : false, jamais d'exception", async () => {
    const { client } = fauxClient(new Error("tableau injoignable"));
    await expect(ajouterTechAuReferentiel(client, "Marc")).resolves.toBe(false);
  });

  test("ajout en échec (réseau, 4xx) : false, jamais d'exception — le push continue", async () => {
    const { client, ajouts } = fauxClient([colonneTech()], { ajoutEchoue: true });
    await expect(ajouterTechAuReferentiel(client, "Marc")).resolves.toBe(false);
    expect(ajouts).toHaveLength(0);
  });
});

// --- Pull : lecture du référentiel -------------------------------------------

describe("lireLabelsReferentiel — pull", () => {
  test("renvoie les libellés actifs de nom_tech (archivés exclus)", async () => {
    const { client } = fauxClient([
      colonneTech({ choices: [choix("BRUCE"), choix("Ancien", true), choix("Marc")] }),
    ]);
    expect(await lireLabelsReferentiel(client)).toEqual(["BRUCE", "Marc"]);
  });

  test("colonne nom_tech absente : liste vide", async () => {
    const { client } = fauxClient([colonneTech({ key: "statut" })]);
    expect(await lireLabelsReferentiel(client)).toEqual([]);
  });

  test("tableau injoignable : liste vide, jamais d'exception — pull classique", async () => {
    const { client } = fauxClient(new Error("tableau injoignable"));
    await expect(lireLabelsReferentiel(client)).resolves.toEqual([]);
  });
});
