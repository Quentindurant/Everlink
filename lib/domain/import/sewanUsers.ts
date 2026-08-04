// Parseur de l'export CSV des utilisateurs Sewan (séparateur ";", champs entre guillemets).
// L'encodage latin-1 est géré en amont (à la lecture du fichier) : ce parseur reçoit du texte
// déjà décodé. Chaque ligne = un utilisateur avec son numéro, son poste et son équipement.

export interface SewanUserRow {
  nom: string; // "NOM Prénom"
  numeroBrut: string; // "+33134083932"
  numeroInterne: string; // "432"
  equipementModele: string | null; // "Yealink T54W"
  equipementMac: string | null; // "44:DB:D2:5B:C1:56"
  email: string | null;
}

function champs(ligne: string): string[] {
  // Champs simples entre guillemets séparés par ";". Pas de ";" ni de saut de ligne internes
  // dans cet export, donc un split direct suffit (on retire juste les guillemets de bord).
  return ligne.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
}

// "'+33134083932 (Pack téléphonie hébergée)" → "0134083932"
// On garde le numéro en chiffres (format national), pas en +33.
function extraireNumero(brut: string): string {
  const n = brut.replace(/^'/, "").split("(")[0].trim();
  // +33X ou 0033X → 0X ; on retire aussi espaces et séparateurs.
  return n
    .replace(/^\+33\s*/, "0")
    .replace(/^0033\s*/, "0")
    .replace(/[^\d]/g, "");
}

// "'432" → "432"
function extraireInterne(brut: string): string {
  return brut.replace(/^'/, "").trim();
}

// "Yealink T54W (44:DB:D2:5B:C1:56)" → { modele: "Yealink T54W", mac: "44:DB:D2:5B:C1:56" }
// "DOKO" → { modele: "DOKO", mac: null }
function extraireEquipement(brut: string): { modele: string | null; mac: string | null } {
  const t = brut.trim();
  if (!t) return { modele: null, mac: null };
  const m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { modele: m[1].trim(), mac: m[2].trim() };
  return { modele: t, mac: null };
}

export function parseSewanUsers(csv: string): { rows: SewanUserRow[]; ignores: number } {
  const lignes = csv.split(/\r?\n/).filter((l) => l.trim());
  const rows: SewanUserRow[] = [];
  let ignores = 0;

  // Ligne 0 = en-têtes.
  for (const ligne of lignes.slice(1)) {
    const c = champs(ligne);
    const nom = [c[0], c[1]].filter(Boolean).join(" ").trim();
    const numeroBrut = extraireNumero(c[2] ?? "");
    // Sans numéro = pas une ligne téléphonique à importer (routeur 4G, compte admin sans poste).
    if (!numeroBrut) {
      ignores++;
      continue;
    }
    const equip = extraireEquipement(c[4] ?? "");
    rows.push({
      nom: nom || "(sans nom)",
      numeroBrut,
      numeroInterne: extraireInterne(c[3] ?? ""),
      equipementModele: equip.modele,
      equipementMac: equip.mac,
      email: (c[8] || c[6] || "").trim() || null,
    });
  }

  return { rows, ignores };
}
