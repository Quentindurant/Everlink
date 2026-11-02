import { describe, expect, test } from "bun:test";
import { adressesCopie, adressesInvalides, decouperAdresses } from "./copie";

describe("decouperAdresses", () => {
  test("accepte virgule, point-virgule, espace et retour à la ligne", () => {
    expect(decouperAdresses("a@x.fr, b@x.fr;c@x.fr\nd@x.fr  e@x.fr")).toEqual([
      "a@x.fr",
      "b@x.fr",
      "c@x.fr",
      "d@x.fr",
      "e@x.fr",
    ]);
  });

  test("retire les doublons sans tenir compte de la casse, garde la première saisie", () => {
    expect(decouperAdresses("Commercial@inovacom.fr, commercial@INOVACOM.fr")).toEqual([
      "Commercial@inovacom.fr",
    ]);
  });

  test("saisie vide ou absente : aucune adresse", () => {
    expect(decouperAdresses("")).toEqual([]);
    expect(decouperAdresses(null)).toEqual([]);
    expect(decouperAdresses(" , ; ")).toEqual([]);
  });
});

describe("adressesCopie", () => {
  test("les deux adresses INOVACOM partent en copie", () => {
    expect(adressesCopie("commercial@inovacom.fr, npereira@inovacom.fr", "client@exemple.fr")).toEqual([
      "commercial@inovacom.fr",
      "npereira@inovacom.fr",
    ]);
  });

  test("le destinataire n'est pas remis en copie", () => {
    expect(adressesCopie("commercial@inovacom.fr, npereira@inovacom.fr", " NPereira@inovacom.fr ")).toEqual([
      "commercial@inovacom.fr",
    ]);
  });
});

describe("adressesInvalides", () => {
  test("signale ce qui n'a pas la forme d'un mail", () => {
    expect(adressesInvalides("commercial@inovacom.fr, npereira, x@y")).toEqual(["npereira", "x@y"]);
  });

  test("une saisie correcte ne remonte rien", () => {
    expect(adressesInvalides("commercial@inovacom.fr; npereira@inovacom.fr")).toEqual([]);
  });
});
