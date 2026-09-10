import { describe, expect, test } from "bun:test";
import { rapprocherLignes, type ClientLite, type LigneSheetLite } from "./rapprochement";

// Cas réels relevés en production : onze dossiers n'étaient jamais appariés au tableau de
// suivi, donc jamais synchronisés. Leur statut restait figé dans l'app alors que les ADV
// l'avaient changé — AQUADOUCE affichait « ATT CLIENT » côté app et « INSTALLATION » côté
// tableau. Ces tests fixent les écritures qui doivent se retrouver.

const ligne = (
  client: string,
  installation = "INSTALLATION",
  dpt = ""
): LigneSheetLite => ({
  client,
  dpt,
  date: "",
  heure: "",
  nomTech: "",
  nomCp: "",
  installation,
});

const client = (id: string, raisonSociale: string, departement: string | null = null): ClientLite => ({
  id,
  raisonSociale,
  zohoNomSheet: null,
  departement,
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

describe("rapprochement — un client, plusieurs sites au tableau", () => {
  test("le département départage deux lignes du même nom", () => {
    // Cas réel : le tableau porte deux sites BEHAGUE, l'app un seul dossier, en 78. Le
    // préfixe était ambigu, la synchronisation renonçait, et le dossier restait sans date.
    const lignes = [
      ligne("ALLIANZ CABINET R. BEHAGUE ET P. HUGUET SAINT CYR L'ECOLE", "INSTALLATION", "78"),
      ligne("ALLIANZ CABINET R. BEHAGUE ET P. HUGUET BOIS COLOMBES", "INSTALLATION", "92"),
    ];
    const clients = [client("c1", "ALLIANZ CABINET R. BEHAGUE ET P. HUGUET", "78")];

    const r = rapprocherLignes(lignes, clients);
    expect(r.apparies).toHaveLength(1);
    expect(r.apparies[0].nomSheet).toBe(
      "ALLIANZ CABINET R. BEHAGUE ET P. HUGUET SAINT CYR L'ECOLE"
    );
    // L'autre site reste orphelin : il n'a pas de dossier, et c'est l'information utile.
    expect(r.lignesInconnues).toEqual(["ALLIANZ CABINET R. BEHAGUE ET P. HUGUET BOIS COLOMBES"]);
  });

  test("sans département au dossier, on ne tranche pas", () => {
    const lignes = [
      ligne("MARTIN PARIS", "INSTALLATION", "75"),
      ligne("MARTIN LYON", "INSTALLATION", "69"),
    ];
    const r = rapprocherLignes(lignes, [client("c1", "MARTIN")]);
    expect(r.apparies).toHaveLength(0);
  });

  test("deux lignes du même département restent ambiguës", () => {
    // Départager au hasard écraserait le statut du mauvais site à chaque synchronisation.
    const lignes = [
      ligne("MARTIN NORD", "INSTALLATION", "75"),
      ligne("MARTIN SUD", "INSTALLATION", "75"),
    ];
    const r = rapprocherLignes(lignes, [client("c1", "MARTIN", "75")]);
    expect(r.apparies).toHaveLength(0);
  });
});

describe("rapprochement — noms voisins mais pas identiques", () => {
  test("un site écrit différemment des deux côtés se retrouve par ses mots", () => {
    // Cas réel : l'app dit « - BOULOGNE », le tableau « - ODESEINE ». Trois mots sur quatre
    // en commun, même département : c'est le même dossier.
    const r = rapprocherLignes(
      [ligne("AMBULANCES NOUVELLES STEPHENSON - ODESEINE", "INSTALLATION", "92")],
      [client("c1", "AMBULANCES NOUVELLES  STEPHENSON - BOULOGNE", "92")]
    );
    expect(r.apparies).toHaveLength(1);
  });

  test("deux villes différentes ne se confondent pas", () => {
    // « MARTIN PARIS » et « MARTIN LYON » ne partagent qu'un mot sur deux : trop peu.
    const r = rapprocherLignes(
      [ligne("MARTIN LYON", "INSTALLATION", "69")],
      [client("c1", "MARTIN PARIS", "69")]
    );
    expect(r.apparies).toHaveLength(0);
  });

  test("un département différent interdit le rapprochement par mots", () => {
    const r = rapprocherLignes(
      [ligne("AMBULANCES NOUVELLES STEPHENSON - ODESEINE", "INSTALLATION", "75")],
      [client("c1", "AMBULANCES NOUVELLES STEPHENSON - BOULOGNE", "92")]
    );
    expect(r.apparies).toHaveLength(0);
  });

  test("deux lignes aussi proches l'une que l'autre restent refusées", () => {
    const r = rapprocherLignes(
      [
        ligne("CABINET DUPONT MARTIN NORD", "INSTALLATION", "75"),
        ligne("CABINET DUPONT MARTIN SUD", "INSTALLATION", "75"),
      ],
      [client("c1", "CABINET DUPONT MARTIN EST", "75")]
    );
    expect(r.apparies).toHaveLength(0);
  });
});
