export function normaliserNumero(brut: string): string {
  let n = brut.replace(/[\s.\-]/g, "");
  if (n.startsWith("+33")) {
    n = "0" + n.slice(3);
  }
  return n;
}

export function normaliserMac(brut: string): string {
  return brut.trim().replace(/[\s.:\-]/g, "").toUpperCase();
}

// Formate une MAC en xx:xx:xx:xx:xx:xx (majuscules), quel que soit le format d'entrée. Une
// valeur qui n'est pas une MAC 12-hexa (IPUI des téléphones DECT sans fil, numéro de série…)
// est laissée telle quelle.
export function formaterMac(brut: string): string {
  const hex = normaliserMac(brut);
  if (/^[0-9A-F]{12}$/.test(hex)) {
    return (hex.match(/.{2}/g) as string[]).join(":");
  }
  return brut.trim();
}
