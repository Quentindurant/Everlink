// Horodatage lisible en heure de Paris : les dates sont stockées en UTC, l'affichage brut
// ISO décalait donc tout de 2h l'été. Format : 10/08/2026 12:05.
export function horodateParis(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
