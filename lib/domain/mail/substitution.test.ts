import { describe, expect, test } from "bun:test";
import { contactSite, substituer, VARIABLES_DISPONIBLES } from "./substitution";

describe("substituer", () => {
  test("remplace les variables connues", () => {
    expect(
      substituer("Bonjour {civilite_nom}, RDV le {date}.", {
        civilite_nom: "M. Durand",
        date: "12/08/2026",
      })
    ).toBe("Bonjour M. Durand, RDV le 12/08/2026.");
  });

  test("laisse les variables inconnues telles quelles (pas de trou silencieux)", () => {
    expect(substituer("Objet {nom_client} — {inconnue}", { nom_client: "AART" })).toBe(
      "Objet AART — {inconnue}"
    );
  });

  test("laisse une variable connue mais non fournie telle quelle", () => {
    expect(substituer("Créneau : {creneau}", {})).toBe("Créneau : {creneau}");
  });

  test("remplace toutes les occurrences", () => {
    expect(substituer("{nom_client} / {nom_client}", { nom_client: "X" })).toBe("X / X");
  });

  test("préserve accents et ponctuation", () => {
    expect(substituer("Éléphant {date} — café", { date: "1er août" })).toBe(
      "Éléphant 1er août — café"
    );
  });

  test("la liste des variables disponibles est exposée", () => {
    expect(VARIABLES_DISPONIBLES).toContain("civilite_nom");
    expect(VARIABLES_DISPONIBLES).toContain("numero_gc");
  });
});

describe("variables des nouveaux modèles", () => {
  test("la boîte mail de la filiale et le contact sur site se substituent", () => {
    const gabarit = "Écrivez à {mail_migration}. Sur place : {contact_site}.";
    const rendu = substituer(gabarit, {
      mail_migration: "migration.ext@everlink-services.fr",
      contact_site: "Jean Dupont — 06 12 34 56 78",
    });
    expect(rendu).toBe(
      "Écrivez à migration.ext@everlink-services.fr. Sur place : Jean Dupont — 06 12 34 56 78."
    );
  });

  test("une variable vide reste visible plutôt que de laisser un trou", () => {
    // Un mail parti avec « Sur place :  » ne se remarque pas ; « {contact_site} » si.
    expect(substituer("Sur place : {contact_site}", { contact_site: "" })).toBe(
      "Sur place : {contact_site}"
    );
  });

  test("les deux nouvelles clés sont proposées à l'édition des modèles", () => {
    expect(VARIABLES_DISPONIBLES).toContain("mail_migration");
    expect(VARIABLES_DISPONIBLES).toContain("contact_site");
  });
});

describe("contactSite", () => {
  const base = { contactNom: "Dupont", contactPrenom: "Jean", contactFixe: null, contactMobile: null };

  test("le mobile prime : c'est le numéro qu'on appelle le jour J", () => {
    expect(contactSite({ ...base, contactFixe: "01 23 45 67 89", contactMobile: "06 12 34 56 78" }))
      .toBe("Jean Dupont — 06 12 34 56 78");
  });

  test("à défaut de mobile, le fixe", () => {
    expect(contactSite({ ...base, contactFixe: "01 23 45 67 89" })).toBe("Jean Dupont — 01 23 45 67 89");
  });

  test("sans téléphone, le nom seul", () => {
    expect(contactSite(base)).toBe("Jean Dupont");
  });

  test("sans contact du tout, la variable reste vide et donc visible dans le mail", () => {
    expect(contactSite({ contactNom: null, contactPrenom: null })).toBe("");
  });
});
