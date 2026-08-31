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
  trouverLigneCible,
  type DonneesLigne,
  type DossierPourSuivi,
} from "./ligneSuivi";

const dossierComplet: DossierPourSuivi = {
  raisonSociale: "ART PHOTO LAB",
  chefProjetNom: "Quentin",
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
      nom_cp: "Quentin",
      statut: "INSTALLATION", // dérivé de l'étape « RDV planifié »
      commentaires_planif: "Prévoir échelle",
      materiel_recu: "OUI",
      num_chrono: "XX123456789FR",
      infos_facturation: "Acompte reçu",
    });
  });

  test("nom_cp porte le chef de projet GC, pas le contact du client", () => {
    // Le contact client s'appelle « Quentin DURANT », le chef de projet « Korantin » :
    // c'est le second qui doit sortir, c'est lui qu'on alerte à J-3.
    const d = construireDonneesLigne({
      ...dossierComplet,
      chefProjetNom: "Korantin",
      contactPrenom: "Quentin",
      contactNom: "DURANT",
    });
    expect(d.nom_cp).toBe("Korantin");
  });

  test("le statut saisi par les ADV prime sur l'étape", () => {
    const d = construireDonneesLigne({ ...dossierComplet, statutSuivi: "STAND BY" });
    expect(d.statut).toBe("STAND BY");
  });

  test("les champs vides sont omis (une cellule absente reste vide dans le tableau)", () => {
    const d = construireDonneesLigne({
      ...dossierComplet,
      chefProjetNom: null,
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
      nomCp: "",
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
    // Annoté : sans type explicite, TypeScript infère une union où « partenaire » est
    // absent de la dernière ligne, incompatible avec l'index signature de DonneesLigne.
    const rows: { data: DonneesLigne }[] = [
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

describe("trouverLigneCible (push : upsert au lieu de créer un doublon)", () => {
  const row = (id: string, client: string, surcharges: Partial<{ archived: boolean; version: number }> = {}) => ({
    id,
    version: surcharges.version ?? 0,
    archived: surcharges.archived ?? false,
    data: { client },
  });

  test("match par le nom mémorisé, prioritaire même si le nom actuel a changé", () => {
    // Le dossier a été renommé côté app : le nom mémorisé retrouve quand même SA ligne,
    // y compris quand une autre ligne porte le nom actuel.
    const lignes = [
      row("r1", "S33 - ART PHOTO LAB"),
      row("r2", "S34 - PHOTO LAB EXPRESS"),
    ];
    const r = trouverLigneCible(lignes, "S33 - ART PHOTO LAB", "S34 - PHOTO LAB EXPRESS");
    expect(r).toEqual({ type: "unique", ligne: lignes[0] });
  });

  test("le préfixe semaine est ignoré : S33 et S34 désignent la même ligne", () => {
    const lignes = [row("r1", "S34 - ART PHOTO LAB")];
    const r = trouverLigneCible(lignes, "S33 - ART PHOTO LAB", "S35 - ART PHOTO LAB");
    expect(r).toEqual({ type: "unique", ligne: lignes[0] });
  });

  test("match par le nom actuel quand aucun nom n'est mémorisé", () => {
    const lignes = [row("r1", "S33 - ART PHOTO LAB"), row("r2", "AUTRE CLIENT")];
    const r = trouverLigneCible(lignes, null, "S33 - ART PHOTO LAB");
    expect(r).toEqual({ type: "unique", ligne: lignes[0] });
  });

  test("nom mémorisé introuvable (ligne renommée par les ADV) : repli sur le nom actuel", () => {
    const lignes = [row("r1", "S33 - ART PHOTO LAB")];
    const r = trouverLigneCible(lignes, "ANCIEN NOM DISPARU", "S33 - ART PHOTO LAB");
    expect(r).toEqual({ type: "unique", ligne: lignes[0] });
  });

  test("casse, accents conservés et espaces multiples : même normalisation que le rapprochement", () => {
    const lignes = [row("r1", "  café  du  Théâtre ")];
    const r = trouverLigneCible(lignes, null, "S33 - CAFÉ DU THÉÂTRE");
    expect(r).toEqual({ type: "unique", ligne: lignes[0] });
  });

  test("plusieurs lignes au même nom : ambigu avec le nombre, on n'écrit rien", () => {
    const lignes = [
      row("r1", "S33 - ART PHOTO LAB"),
      row("r2", "S34 - ART PHOTO LAB"),
      row("r3", "AUTRE CLIENT"),
    ];
    expect(trouverLigneCible(lignes, null, "ART PHOTO LAB")).toEqual({ type: "ambigu", nombre: 2 });
    // Même verdict quand c'est le nom mémorisé qui est dupliqué.
    expect(trouverLigneCible(lignes, "ART PHOTO LAB", "NOM TOUT NEUF")).toEqual({ type: "ambigu", nombre: 2 });
  });

  test("aucune correspondance : absente (le push créera la ligne)", () => {
    const lignes = [row("r1", "AUTRE CLIENT")];
    expect(trouverLigneCible(lignes, null, "ART PHOTO LAB")).toEqual({ type: "absente" });
    expect(trouverLigneCible([], "ART PHOTO LAB", "ART PHOTO LAB")).toEqual({ type: "absente" });
  });

  test("les lignes archivées sont ignorées", () => {
    const archivee = row("r1", "S33 - ART PHOTO LAB", { archived: true });
    // Seule une archivée porte le nom : absente, on recrée une ligne vivante.
    expect(trouverLigneCible([archivee], null, "ART PHOTO LAB")).toEqual({ type: "absente" });
    // Une archivée + une vivante : la vivante gagne, pas d'ambigu.
    const vivante = row("r2", "S34 - ART PHOTO LAB");
    expect(trouverLigneCible([archivee, vivante], null, "ART PHOTO LAB")).toEqual({ type: "unique", ligne: vivante });
  });

  test("cellules client vides : jamais appariées, même à un nom qui se normalise à vide", () => {
    const lignes = [row("r1", ""), row("r2", "   ")];
    expect(trouverLigneCible(lignes, null, "ART PHOTO LAB")).toEqual({ type: "absente" });
    expect(trouverLigneCible(lignes, null, "  ")).toEqual({ type: "absente" });
  });
});

describe("champsAMettreAJour (pull : un champ vide n'écrase jamais)", () => {
  const dossier = {
    zohoNomSheet: "S33 - ART PHOTO LAB",
    statutSuivi: "NEW",
    dateIntervention: new Date(Date.UTC(2026, 7, 12)),
    creneauIntervention: "14h",
    technicienId: "t1",
    chefProjetNom: null,
};
  const ligneVide = {
    date: "",
    heure: "",
    nomTech: "",
    nomCp: "",
    installation: "",
    client: "S33 - ART PHOTO LAB",
  };

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
      { ...ligneVide, installation: " installation ", date: "20/08/2026", heure: "9H" },
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
