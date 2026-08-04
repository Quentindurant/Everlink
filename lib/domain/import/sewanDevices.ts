// Parseur de l'export CSV des équipements (devices) Sewan. Même famille que sewanUsers:
// séparateur ";", champs éventuellement entre guillemets, encodage latin-1 décodé en amont.
// Colonnes: Modèle;Identifiant;N° de série;Nb Ports;Label;Propriétaire;Utilisateur;...

export interface SewanDeviceRow {
  modele: string;
  // Identifiant matériel tel qu'exporté: MAC hex sans séparateur ("805E0C5D0B2E") ou IPUI DECT
  // ("0291EE3460"). Le suffixe " - YEALINK" éventuel est retiré.
  mac: string;
  // Email Sewan de l'utilisateur si le device lui est rattaché (sert au dédoublonnage visuel).
  utilisateurSewan: string | null;
}

function champs(ligne: string): string[] {
  return ligne.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
}

export function parseSewanDevices(csv: string): { rows: SewanDeviceRow[]; ignores: number } {
  const lignes = csv.split(/\r?\n/).filter((l) => l.trim());
  const rows: SewanDeviceRow[] = [];
  let ignores = 0;

  for (const ligne of lignes.slice(1)) {
    const c = champs(ligne);
    const modele = c[0] ?? "";
    // "0291EE3460 - YEALINK" → "0291EE3460"
    const mac = (c[1] ?? "").split(" - ")[0].trim();
    if (!mac) {
      ignores++;
      continue;
    }
    rows.push({
      modele: modele || "(modèle inconnu)",
      mac,
      utilisateurSewan: (c[6] ?? "").trim() || null,
    });
  }

  return { rows, ignores };
}
