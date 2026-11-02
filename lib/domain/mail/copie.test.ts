import { describe, expect, test } from "bun:test";
import { adressesCopie, adressesInvalides, decouperAdresses, restreindreCopie } from "./copie";

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

describe("restreindreCopie", () => {
  const configurees = ["commercial@inovacom.fr", "npereira@inovacom.fr"];

  test("sans retrait demandé, toute la copie réglée part", () => {
    expect(restreindreCopie(configurees, undefined)).toEqual(configurees);
  });

  test("une adresse retirée dans le composeur ne part pas", () => {
    expect(restreindreCopie(configurees, ["NPereira@inovacom.fr"])).toEqual(["npereira@inovacom.fr"]);
  });

  test("tout retirer : aucune copie", () => {
    expect(restreindreCopie(configurees, [])).toEqual([]);
  });

  test("une adresse inconnue envoyée par le navigateur est ignorée", () => {
    expect(restreindreCopie(configurees, ["commercial@inovacom.fr", "pirate@exemple.fr"])).toEqual([
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
