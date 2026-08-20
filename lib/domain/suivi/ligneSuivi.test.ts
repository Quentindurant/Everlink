import { describe, expect, test } from "bun:test";
import {
  affectationsDepuisRows,
  champsAMettreAJour,
  construireDonneesLigne,
  dateVersIso,
  estLigneEverlink,
  isoVersFr,
  libelleMoisSuivi,
  ligneDepuisRow,
  moisCourant,
  moisDuDossier,
  type DossierPourSuivi,
} from "./ligneSuivi";

const dossierComplet: DossierPourSuivi = {
  raisonSociale: "ART PHOTO LAB",
  departement: "49",
  adresse: "12 rue des Lilas 49000 ANGERS",
  scenario: "Scénario 2",
  dateIntervention: new Date(Date.UTC(2026, 7, 12)), // mercredi 12/08/2026, semaine 33
  creneauIntervention: "14h",
  commentaire: "Prévoir échelle",
  referenceClient: "REF-42",
  contactNom: "DURANT",
  contactPrenom: "Quentin",
  etapeLibelle: "RDV planifié",
  prestataireNom: "GC DEV",
  technicienNom: "Bruce",
  statutSuivi: null,
  dateImperative: new Date(Date.UTC(2026, 7, 31)),
  materielRecu: "OUI",
  numeroChrono: "XX123456789FR",
  infosFacturation: "Acompte reçu",
};

describe("dateVersIso / isoVersFr", () => {
  test("convertit une Date en ISO AAAA-MM-JJ (UTC) et null en chaîne vide", () => {
    expect(dateVersIso(new Date(Date.UTC(2026, 7, 12)))).toBe("2026-08-12");
    expect(dateVersIso(new Date(Date.UTC(2026, 0, 3)))).toBe("2026-01-03");
    expect(dateVersIso(null)).toBe("");
  });

  test("isoVersFr convertit AAAA-MM-JJ en JJ/MM/AAAA et laisse le reste intact", () => {
    expect(isoVersFr("2026-08-12")).toBe("12/08/2026");
    expect(isoVersFr(" 2026-01-03 ")).toBe("03/01/2026");
    // Saisie libre (cellule DATE remplie à la main) : on ne casse rien.
    expect(isoVersFr("12/08/2026")).toBe("12/08/2026");
    expect(isoVersFr("à confirmer")).toBe("à confirmer");
    expect(isoVersFr("")).toBe("");
  });
});

describe("mois", () => {
  test("moisCourant produit AAAA-MM", () => {
    expect(moisCourant(new Date(Date.UTC(2026, 7, 20)))).toBe("2026-08");
    expect(moisCourant(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
  });

  test("moisDuDossier suit la date d'intervention, sinon le mois courant", () => {
    expect(moisDuDossier(new Date(Date.UTC(2026, 9, 2)), new Date(Date.UTC(2026, 7, 20)))).toBe("2026-10");
    expect(moisDuDossier(null, new Date(Date.UTC(2026, 7, 20)))).toBe("2026-08");
  });

  test("libelleMoisSuivi restitue le libellé mensuel des onglets historiques", () => {
    expect(libelleMoisSuivi("2026-08")).toBe("AOUT 2026");
    expect(libelleMoisSuivi("2027-02")).toBe("FEVRIER 2027");
    // Entrée inattendue : renvoyée telle quelle plutôt que d'inventer.
    expect(libelleMoisSuivi("n'importe quoi")).toBe("n'importe quoi");
  });
});

describe("construireDonneesLigne (push : mapping 16 colonnes)", () => {
  test("mappe chaque champ du dossier sur la clé de colonne du tableau", () => {
    const d = construireDonneesLigne(dossierComplet);
    expect(d).toEqual({
      impe: "2026-08-31",
      client: "S33 - ART PHOTO LAB",
      dpt: "49",
      cp_client: "49000",
      partenaire: "EVERLINK",
      date: "2026-08-12",
      porta_commentaires: "Scénario 2 — REF-42",
      heure: "14h",
      tech: "GC DEV",
      nom_tech: "Bruce",
      nom_cp: "Quentin DURANT",
      statut: "INSTALLATION", // dérivé de l'étape « RDV planifié »
      commentaires_planif: "Prévoir échelle",
      materiel_recu: "OUI",
      num_chrono: "XX123456789FR",
      infos_facturation: "Acompte reçu",
    });
  });

  test("le statut saisi par les ADV prime sur l'étape", () => {
    const d = construireDonneesLigne({ ...dossierComplet, statutSuivi: "STAND BY" });
    expect(d.statut).toBe("STAND BY");
  });

  test("les champs vides sont omis (une cellule absente reste vide dans le tableau)", () => {
    const d = construireDonneesLigne({
      ...dossierComplet,
      dateImperative: null,
      adresse: null,
      scenario: null,
      referenceClient: null,
      creneauIntervention: null,
      prestataireNom: null,
      technicienNom: null,
      contactNom: null,
      contactPrenom: null,
      commentaire: null,
      materielRecu: null,
      numeroChrono: null,
      infosFacturation: null,
    });
    expect(Object.keys(d).sort()).toEqual(["client", "date", "dpt", "partenaire", "statut"]);
  });

  test("sans date d'intervention, le client part sans préfixe semaine", () => {
    const d = construireDonneesLigne({ ...dossierComplet, dateIntervention: null });
    expect(d.client).toBe("ART PHOTO LAB");
    expect(d.date).toBeUndefined();
  });
});

describe("ligneDepuisRow / estLigneEverlink (pull : mapping inverse)", () => {
  const data = {
    client: "S33 - ART PHOTO LAB",
    dpt: "49",
    date: "2026-08-12",
    heure: "14h",
    tech: "GC DEV",
    nom_tech: "Bruce",
    statut: "INSTALLATION",
    porta_commentaires: "Scénario 2 — REF-42",
    partenaire: "EVERLINK",
    num_chrono: 78,
  };

  test("reconstruit la ligne au format historique (date FR incluse)", () => {
    expect(ligneDepuisRow(data)).toEqual({
      client: "S33 - ART PHOTO LAB",
      dpt: "49",
      date: "12/08/2026",
      heure: "14h",
      tech: "GC DEV",
      nomTech: "Bruce",
      installation: "INSTALLATION",
      commentaires: "Scénario 2 — REF-42",
    });
  });

  test("cellules absentes ou null deviennent des chaînes vides", () => {
    const l = ligneDepuisRow({ client: "X", statut: null });
    expect(l.dpt).toBe("");
    expect(l.date).toBe("");
    expect(l.installation).toBe("");
  });

  test("estLigneEverlink filtre sur la colonne partenaire, casse ignorée", () => {
    expect(estLigneEverlink(data)).toBe(true);
    expect(estLigneEverlink({ ...data, partenaire: " everlink " })).toBe(true);
    expect(estLigneEverlink({ ...data, partenaire: "OR-TEL" })).toBe(false);
    expect(estLigneEverlink({})).toBe(false);
  });
});

describe("affectationsDepuisRows (disponibilité techniciens)", () => {
  test("remonte NOM TECH + DATE (format FR) de toutes les lignes, tous partenaires", () => {
    const rows = [
      { data: { nom_tech: "Bruce", date: "2026-08-12", partenaire: "EVERLINK" } },
      { data: { nom_tech: "Momo", date: "2026-08-13", partenaire: "OR-TEL" } },
      { data: { nom_tech: "", date: "2026-08-14" } },
    ];
    expect(affectationsDepuisRows(rows)).toEqual([
      { nomTech: "Bruce", date: "12/08/2026" },
      { nomTech: "Momo", date: "13/08/2026" },
      { nomTech: "", date: "14/08/2026" },
    ]);
  });
});

describe("champsAMettreAJour (pull : un champ vide n'écrase jamais)", () => {
  const dossier = {
    zohoNomSheet: "S33 - ART PHOTO LAB",
    statutSuivi: "NEW",
    dateIntervention: new Date(Date.UTC(2026, 7, 12)),
    creneauIntervention: "14h",
    technicienId: "t1",
  };
  const ligneVide = { date: "", heure: "", nomTech: "", installation: "", client: "S33 - ART PHOTO LAB" };

  test("ligne entièrement vide : aucun champ à mettre à jour", () => {
    expect(champsAMettreAJour(dossier, ligneVide, "S33 - ART PHOTO LAB", null)).toEqual({});
  });

  test("mémorise le nom du tableau quand il change", () => {
    const data = champsAMettreAJour(dossier, ligneVide, "S34 - ART PHOTO LAB", null);
    expect(data).toEqual({ zohoNomSheet: "S34 - ART PHOTO LAB" });
  });

  test("statut, date, heure et technicien redescendent quand ils diffèrent", () => {
    const data = champsAMettreAJour(
      dossier,
      { ...ligneVide, installation: " installation ", date: "20/08/2026", heure: "9H", nomTech: "Momo" },
      "S33 - ART PHOTO LAB",
      "t2"
    );
    expect(data.statutSuivi).toBe("INSTALLATION");
    expect(data.dateIntervention).toEqual(new Date(Date.UTC(2026, 7, 20)));
    expect(data.creneauIntervention).toBe("9H");
    expect(data.technicienId).toBe("t2");
  });

  test("valeurs identiques ou date illisible : rien à écrire", () => {
    const data = champsAMettreAJour(
      dossier,
      { ...ligneVide, installation: "NEW", date: "à confirmer", heure: "14h" },
      "S33 - ART PHOTO LAB",
      "t1"
    );
    expect(data).toEqual({});
  });
});
