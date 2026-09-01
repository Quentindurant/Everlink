import { describe, expect, test } from "bun:test";
import { rapprocherLignes, type ClientLite, type LigneSheetLite } from "./rapprochement";

// Cas réels relevés en production : onze dossiers n'étaient jamais appariés au tableau de
// suivi, donc jamais synchronisés. Leur statut restait figé dans l'app alors que les ADV
// l'avaient changé — AQUADOUCE affichait « ATT CLIENT » côté app et « INSTALLATION » côté
// tableau. Ces tests fixent les écritures qui doivent se retrouver.

const ligne = (client: string, installation = "INSTALLATION"): LigneSheetLite => ({
  client,
  date: "",
  heure: "",
  nomTech: "",
  nomCp: "",
  installation,
});

const client = (id: string, raisonSociale: string): ClientLite => ({
  id,
  raisonSociale,
  zohoNomSheet: null,
});

describe("rapprochement — séparateurs différents entre l'app et le tableau", () => {
  test("« / » côté app et « - » côté tableau désignent le même client", () => {
    // Le vrai piège d'AQUADOUCE : les deux sites ne diffèrent que par le séparateur, si bien
    // que l'égalité échouait et que le préfixe « AQUADOUCE SERVICE » devenait ambigu.
    const lignes = [
      ligne("AQUADOUCE SERVICE", "INSTALLATION"),
      ligne("AQUADOUCE SERVICE - LES TERRES ESSENTIELLES", "ATT CLIENT"),
    ];
    const clients = [
      client("c1", "AQUADOUCE SERVICE / AQUADOUCE SERVICE"),
      client("c2", "AQUADOUCE SERVICE / LES TERRES ESSENTIELLES"),
    ];

    const r = rapprocherLignes(lignes, clients);
    expect(r.lignesInconnues).toEqual([]);

    const parClient = Object.fromEntries(r.apparies.map((a) => [a.clientId, a.ligne.installation]));
    expect(parClient.c1).toBe("INSTALLATION");
    expect(parClient.c2).toBe("ATT CLIENT");
  });

  test("les espaces doubles du tableau ne cassent pas l'appariement", () => {
    const r = rapprocherLignes(
      [ligne("AMBULANCES NOUVELLES STEPHENSON - BOULOGNE")],
      [client("c1", "AMBULANCES NOUVELLES  STEPHENSON - BOULOGNE")]
    );
    expect(r.apparies).toHaveLength(1);
  });

  test("la ponctuation d'un nom commercial ne bloque plus", () => {
    const r = rapprocherLignes(
      [ligne("TODS ST TROPEZ"), ligne("ANGLAIS ANTONY (WALL STREET ENGLISH)")],
      [client("c1", "TOD'S ST TROPEZ"), client("c2", "ANGLAIS @ ANTONY (WALL STREET ENGLISH)")]
    );
    expect(r.apparies).toHaveLength(2);
  });
});

describe("rapprochement — ce qui doit rester refusé", () => {
  test("deux clients réellement distincts ne se volent pas leur ligne", () => {
    const r = rapprocherLignes(
      [ligne("ALLIANZ MONTROUGE")],
      [client("c1", "ALLIANZ RICHARD LEVEQUE CHARENTON"), client("c2", "ALLIANZ MONTROUGE")]
    );
    expect(r.apparies).toHaveLength(1);
    expect(r.apparies[0].clientId).toBe("c2");
  });

  test("un préfixe ambigu reste sans appariement plutôt que d'en inventer un", () => {
    // Deux sites, une seule ligne : impossible de trancher, on ne devine pas.
    const r = rapprocherLignes(
      [ligne("MARTIN")],
      [client("c1", "MARTIN PARIS"), client("c2", "MARTIN LYON")]
    );
    expect(r.apparies).toHaveLength(0);
    expect(r.lignesInconnues).toEqual(["MARTIN"]);
  });
});
