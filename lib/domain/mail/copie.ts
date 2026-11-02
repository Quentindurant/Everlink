// Adresses mises en copie d'un envoi. Logique pure, testable.
//
// La saisie vient de Paramètres, champ libre : on accepte virgule, point-virgule, espace ou
// retour à la ligne comme séparateur, parce que c'est ce que l'ADV colle depuis Outlook.

const FORMAT_MAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Découpe une saisie en adresses, sans doublon (casse ignorée), dans l'ordre de saisie. */
export function decouperAdresses(saisie: string | null | undefined): string[] {
  const vues = new Set<string>();
  const adresses: string[] = [];
  for (const brute of (saisie ?? "").split(/[,;\s]+/)) {
    const adresse = brute.trim();
    if (!adresse || vues.has(adresse.toLowerCase())) continue;
    vues.add(adresse.toLowerCase());
    adresses.push(adresse);
  }
  return adresses;
}

/**
 * Adresses à mettre en copie d'un envoi. Le destinataire en est retiré : le mettre aussi en
 * copie lui ferait recevoir le message deux fois.
 */
export function adressesCopie(saisie: string | null | undefined, destinataire: string): string[] {
  const dest = destinataire.trim().toLowerCase();
  return decouperAdresses(saisie).filter((a) => a.toLowerCase() !== dest);
}

/**
 * Copie d'un envoi après les retraits faits dans le composeur. La liste reçue du navigateur
 * ne peut que retirer des adresses réglées dans Paramètres, jamais en ajouter : sinon
 * l'action d'envoi servirait à écrire à n'importe qui en copie au nom du partenaire.
 * Sans liste (undefined), toute la copie réglée part.
 */
export function restreindreCopie(configurees: string[], retenues: string[] | undefined): string[] {
  if (!retenues) return configurees;
  const gardees = new Set(retenues.map((a) => a.trim().toLowerCase()));
  return configurees.filter((a) => gardees.has(a.toLowerCase()));
}

/** Adresses de la saisie qui n'ont pas la forme d'un mail, pour refuser l'enregistrement. */
export function adressesInvalides(saisie: string | null | undefined): string[] {
  return decouperAdresses(saisie).filter((a) => !FORMAT_MAIL.test(a));
}
