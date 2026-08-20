import { describe, expect, test } from "bun:test";
import { creerSuiviClient, type SuiviRow } from "./suiviClient";

// --- Outillage : faux fetch enregistrant les appels -------------------------

interface Appel {
  url: string;
  method: string;
  corps: unknown;
  cookie: string | null;
}

function reponse(status: number, corps: unknown, enTetes: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (nom: string) => enTetes[nom.toLowerCase()] ?? null,
      getSetCookie: () => (enTetes["set-cookie"] ? [enTetes["set-cookie"]] : []),
    },
    json: async () => corps,
  } as unknown as Response;
}

const ligne = (surcharges: Partial<SuiviRow> = {}): SuiviRow => ({
  id: "r1",
  month: "2026-08",
  position: 0,
  data: { client: "ART PHOTO LAB", partenaire: "EVERLINK" },
  version: 0,
  archived: false,
  ...surcharges,
});

// Scénario : chaque appel consomme la prochaine réponse correspondant à son chemin.
function fauxServeur(plan: { chemin: string; rep: Response }[]) {
  const appels: Appel[] = [];
  const restantes = [...plan];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = String(url);
    const enTetes = (init?.headers ?? {}) as Record<string, string>;
    appels.push({
      url: u,
      method: init?.method ?? "GET",
      corps: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      cookie: enTetes["Cookie"] ?? enTetes["cookie"] ?? null,
    });
    const i = restantes.findIndex((p) => u.includes(p.chemin));
    if (i === -1) throw new Error(`Réponse non planifiée pour ${u}`);
    const [{ rep }] = restantes.splice(i, 1);
    return rep;
  };
  return { appels, fetchImpl };
}

const OPTIONS = {
  baseUrl: "https://suivie.appgcd.fr",
  email: "everlink@appgcd.fr",
  password: "secret",
  cacheMs: 0,
};

const loginOk = (jeton: string) =>
  reponse(200, { user: { id: "u1" } }, { "set-cookie": `token=${jeton}; Path=/; HttpOnly; SameSite=Lax` });

// --- Tests ------------------------------------------------------------------

describe("suiviClient — session", () => {
  test("se connecte au premier appel puis réutilise le cookie de session", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("jeton-1") },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, [ligne()]) },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, [ligne()]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });

    const lignes = await client.lireLignesMois("2026-08");
    await client.lireLignesMois("2026-08");

    expect(lignes).toHaveLength(1);
    const logins = appels.filter((a) => a.url.includes("/api/auth/login"));
    expect(logins).toHaveLength(1);
    expect(logins[0].method).toBe("POST");
    expect(logins[0].corps).toEqual({ email: "everlink@appgcd.fr", password: "secret" });
    const lectures = appels.filter((a) => a.url.includes("/api/rows"));
    expect(lectures).toHaveLength(2);
    expect(lectures[0].cookie).toBe("token=jeton-1");
    expect(lectures[1].cookie).toBe("token=jeton-1");
  });

  test("session expirée : re-login automatique sur 401 puis relance de l'appel", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("jeton-1") },
      { chemin: "/api/rows", rep: reponse(401, { code: "AUTH_REQUIRED", message: "Session expirée" }) },
      { chemin: "/api/auth/login", rep: loginOk("jeton-2") },
      { chemin: "/api/rows", rep: reponse(200, [ligne()]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });

    const lignes = await client.lireLignesMois("2026-08");

    expect(lignes).toHaveLength(1);
    expect(appels.filter((a) => a.url.includes("/api/auth/login"))).toHaveLength(2);
    const lectures = appels.filter((a) => a.url.includes("/api/rows"));
    expect(lectures[1].cookie).toBe("token=jeton-2");
  });

  test("identifiants refusés : erreur explicite", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: reponse(401, { code: "AUTH_INVALID", message: "E-mail ou mot de passe incorrect." }) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    await expect(client.lireLignesMois("2026-08")).rejects.toThrow(/mot de passe|connexion/i);
  });

  test("l'URL de base tolère un slash final ou un suffixe /api", async () => {
    for (const baseUrl of ["https://suivie.appgcd.fr/", "https://suivie.appgcd.fr/api", "https://suivie.appgcd.fr/api/"]) {
      const { appels, fetchImpl } = fauxServeur([
        { chemin: "/api/auth/login", rep: loginOk("j") },
        { chemin: "/api/rows", rep: reponse(200, []) },
      ]);
      const client = creerSuiviClient({ ...OPTIONS, baseUrl, fetchImpl });
      await client.lireLignesMois("2026-08");
      expect(appels[0].url).toBe("https://suivie.appgcd.fr/api/auth/login");
      expect(appels[1].url).toBe("https://suivie.appgcd.fr/api/rows?month=2026-08");
    }
  });
});

describe("suiviClient — lecture et cache", () => {
  test("le cache mémoire évite de relire le même mois dans la foulée", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, [ligne()]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, cacheMs: 60_000, fetchImpl });
    await client.lireLignesMois("2026-08");
    await client.lireLignesMois("2026-08");
    expect(appels.filter((a) => a.url.includes("/api/rows"))).toHaveLength(1);
  });

  test("créer une ligne invalide le cache du mois", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, []) },
      { chemin: "/api/rows", rep: reponse(201, ligne()) },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, [ligne()]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, cacheMs: 60_000, fetchImpl });
    await client.lireLignesMois("2026-08");
    await client.creerLigne("2026-08");
    const lignes = await client.lireLignesMois("2026-08");
    expect(lignes).toHaveLength(1);
  });
});

describe("suiviClient — écriture", () => {
  test("creerLigne poste le mois et renvoie la ligne créée", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows", rep: reponse(201, ligne({ id: "r9", month: "2026-09", version: 0 })) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    const row = await client.creerLigne("2026-09");
    expect(row.id).toBe("r9");
    const creation = appels.find((a) => a.method === "POST" && a.url.endsWith("/api/rows"));
    expect(creation?.corps).toEqual({ month: "2026-09" });
  });

  test("patcherLigne envoie expectedVersion + patch et renvoie la ligne à jour", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows/r1", rep: reponse(200, ligne({ version: 4, data: { statut: "STAND BY" } })) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    const r = await client.patcherLigne("r1", 3, { statut: "STAND BY" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.row.version).toBe(4);
    const patch = appels.find((a) => a.method === "PATCH");
    expect(patch?.corps).toEqual({ expectedVersion: 3, patch: { statut: "STAND BY" } });
  });

  test("conflit 409 : relecture de la version courante puis unique nouvel essai", async () => {
    const conflit = reponse(409, {
      code: "VERSION_CONFLICT",
      message: "Cette ligne a été modifiée entre-temps.",
      details: { current: ligne({ version: 7 }), conflictKeys: ["statut"] },
    });
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows/r1", rep: conflit },
      { chemin: "/api/rows/r1", rep: reponse(200, ligne({ version: 8 })) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    const r = await client.patcherLigne("r1", 3, { statut: "STAND BY" });
    expect(r.success).toBe(true);
    const patchs = appels.filter((a) => a.method === "PATCH");
    expect(patchs).toHaveLength(2);
    expect((patchs[1].corps as { expectedVersion: number }).expectedVersion).toBe(7);
  });

  test("second conflit 409 : abandon avec les clés en conflit", async () => {
    const conflit = () =>
      reponse(409, {
        code: "VERSION_CONFLICT",
        message: "Cette ligne a été modifiée entre-temps.",
        details: { current: ligne({ version: 7 }), conflictKeys: ["statut"] },
      });
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows/r1", rep: conflit() },
      { chemin: "/api/rows/r1", rep: conflit() },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    const r = await client.patcherLigne("r1", 3, { statut: "STAND BY" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.conflictKeys).toEqual(["statut"]);
      expect(r.error).toMatch(/modifiée/);
    }
    expect(appels.filter((a) => a.method === "PATCH")).toHaveLength(2);
  });

  test("autre erreur HTTP : échec propre sans nouvel essai", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows/r1", rep: reponse(404, { code: "NOT_FOUND", message: "Ligne introuvable." }) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    const r = await client.patcherLigne("r1", 3, { statut: "X" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/introuvable/i);
    expect(appels.filter((a) => a.method === "PATCH")).toHaveLength(1);
  });
});

describe("suiviClient — supprimerLigne (compensation du push)", () => {
  test("efface la ligne avec la session et vide le cache de lecture", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, [ligne()]) },
      { chemin: "/api/rows/r1", rep: reponse(200, ligne()) },
      { chemin: "/api/rows?month=2026-08", rep: reponse(200, []) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, cacheMs: 60_000, fetchImpl });

    await client.lireLignesMois("2026-08");
    await client.supprimerLigne("r1");

    const suppression = appels.find((a) => a.method === "DELETE");
    expect(suppression?.url).toContain("/api/rows/r1");
    expect(suppression?.cookie).toBe("token=j");
    // Cache invalidé : la relecture repart au serveur (4e réponse planifiée).
    expect(await client.lireLignesMois("2026-08")).toHaveLength(0);
  });

  test("refus du serveur : erreur explicite pour le meilleur-effort de l'appelant", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/rows/r1", rep: reponse(404, { code: "NOT_FOUND", message: "Ligne introuvable." }) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    await expect(client.supprimerLigne("r1")).rejects.toThrow(/introuvable/i);
  });
});

// --- Référentiel : colonnes et choix -----------------------------------------

const choix = (label: string) => ({
  id: `ch-${label}`,
  columnId: "c-tech",
  label,
  bgColor: null,
  textColor: null,
  bold: false,
  position: 0,
  archived: false,
});

const colonneTech = (choices: unknown[] = []) => ({
  id: "c-tech",
  key: "nom_tech",
  label: "NOM TECH",
  type: "SELECT",
  position: 6,
  width: 150,
  visible: true,
  choices,
});

describe("suiviClient — lireColonnes", () => {
  test("lit les colonnes avec leurs choix, avec la session, puis sert le cache", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/columns", rep: reponse(200, [colonneTech([choix("BRUCE")])]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, cacheMs: 60_000, fetchImpl });

    const colonnes = await client.lireColonnes();
    await client.lireColonnes();

    expect(colonnes).toHaveLength(1);
    expect(colonnes[0].key).toBe("nom_tech");
    expect(colonnes[0].choices.map((c) => c.label)).toEqual(["BRUCE"]);
    const lectures = appels.filter((a) => a.url.endsWith("/api/columns"));
    expect(lectures).toHaveLength(1);
    expect(lectures[0].cookie).toBe("token=j");
  });

  test("erreur serveur : échec explicite", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/columns", rep: reponse(500, { message: "boom" }) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    await expect(client.lireColonnes()).rejects.toThrow(/boom/);
  });
});

describe("suiviClient — ajouterChoix (référentiel techniciens)", () => {
  test("poste le libellé avec les couleurs par défaut du tableau", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/choices", rep: reponse(201, choix("Marc")) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });

    await client.ajouterChoix("c-tech", "Marc");

    const creation = appels.find((a) => a.method === "POST" && a.url.includes("/choices"));
    expect(creation?.url).toBe("https://suivie.appgcd.fr/api/columns/c-tech/choices");
    // Mêmes valeurs que le formulaire « nouveau choix » des Paramètres du tableau
    // (FOND_DEFAUT / TEXTE_DEFAUT / gras décoché).
    expect(creation?.corps).toEqual({ label: "Marc", bgColor: "#ffffff", textColor: "#000000", bold: false });
    expect(creation?.cookie).toBe("token=j");
  });

  test("422 « existe déjà » (course entre deux pushs) : succès silencieux", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      {
        chemin: "/choices",
        rep: reponse(422, { code: "VALIDATION_FAILED", message: "La valeur « Marc » existe déjà dans cette liste." }),
      },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    await expect(client.ajouterChoix("c-tech", "Marc")).resolves.toBeUndefined();
  });

  test("autre 422 (validation) : erreur explicite", async () => {
    const { fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/choices", rep: reponse(422, { code: "VALIDATION_FAILED", message: "Données invalides." }) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, fetchImpl });
    await expect(client.ajouterChoix("c-tech", "")).rejects.toThrow(/invalides/i);
  });

  test("ajout réussi : le cache des colonnes est invalidé", async () => {
    const { appels, fetchImpl } = fauxServeur([
      { chemin: "/api/auth/login", rep: loginOk("j") },
      { chemin: "/api/columns", rep: reponse(200, [colonneTech()]) },
      { chemin: "/choices", rep: reponse(201, choix("Marc")) },
      { chemin: "/api/columns", rep: reponse(200, [colonneTech([choix("Marc")])]) },
    ]);
    const client = creerSuiviClient({ ...OPTIONS, cacheMs: 60_000, fetchImpl });

    await client.lireColonnes();
    await client.ajouterChoix("c-tech", "Marc");
    const colonnes = await client.lireColonnes();

    expect(colonnes[0].choices).toHaveLength(1);
    expect(appels.filter((a) => a.method === "GET" && a.url.endsWith("/api/columns"))).toHaveLength(2);
  });
});
