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
