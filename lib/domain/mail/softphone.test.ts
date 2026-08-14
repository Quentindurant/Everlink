import { describe, expect, test } from "bun:test";
import { blocGuidesSpeek, blocPreparationSpeek } from "./softphone";

describe("blocPreparationSpeek", () => {
  test("accorde le nombre d'utilisateurs concernés", () => {
    expect(blocPreparationSpeek(1)).toContain("L'un de vos collaborateurs utilise");
    expect(blocPreparationSpeek(4)).toContain("4 de vos collaborateurs utilisent");
  });

  test("demande l'installation avant l'intervention et la confirmation", () => {
    const bloc = blocPreparationSpeek(2);
    expect(bloc).toContain("AVANT notre intervention");
    expect(bloc).toContain("confirmer");
    // Le point de blocage vécu sur le terrain : l'informaticien du client.
    expect(bloc).toContain("service informatique");
  });
});

describe("blocGuidesSpeek", () => {
  test("rien à annoncer sans guide", () => {
    expect(blocGuidesSpeek(0)).toBe("");
  });

  test("singulier et pluriel", () => {
    expect(blocGuidesSpeek(1)).toContain("en pièce jointe le guide d'utilisation");
    expect(blocGuidesSpeek(3)).toContain("en pièces jointes les guides d'utilisation");
  });
});
