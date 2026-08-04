// Extrait des codes de département depuis une cellule en texte libre (fichier techniciens :
// "54, 55, 57, 88", "74100 Annemasse", "Viens du 62", "75-77-78..."). Best-effort :
// - un nombre à 5 chiffres est un code postal → département = 2 premiers chiffres
// - un nombre à 1-2 chiffres entre 1 et 95 est un département
// - le reste est ignoré. Résultat dédoublonné, dans l'ordre d'apparition.

export function extraireDepartements(texte: string): string[] {
  if (!texte) return [];
  const out: string[] = [];
  const vus = new Set<string>();
  const ajouter = (dep: string) => {
    if (!vus.has(dep)) {
      vus.add(dep);
      out.push(dep);
    }
  };

  for (const m of texte.matchAll(/\d+/g)) {
    const n = m[0];
    if (n.length === 5) {
      // Code postal → département (2 premiers chiffres, "01".."95").
      ajouter(n.slice(0, 2));
    } else if (n.length <= 2) {
      const v = parseInt(n, 10);
      if (v >= 1 && v <= 95) ajouter(n.padStart(2, "0"));
    }
    // 3-4 chiffres (ex "100 postes") : ignorés.
  }
  return out;
}
