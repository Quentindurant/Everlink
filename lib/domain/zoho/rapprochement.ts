// Rapprochement des lignes du Zoho Sheet avec les clients de l'app, sans jamais renommer
// ni d'un côté ni de l'autre : les ADV nomment librement dans le Sheet ("S31- ART PHOTO
// LAB", "AART ELECTRONICS CHANTELOUP"), l'app garde la raison sociale exacte.
//
// Priorité de match, par client :
//   1. zohoNomSheet mémorisé (nom exact de la ligne déjà appariée) ;
//   2. égalité des noms normalisés (préfixe semaine retiré, casse/espaces ignorés) ;
//   3. préfixe : le nom app commence le nom Sheet normalisé, ou l'inverse — accepté
//      seulement si UNE seule ligne et UN seul client se correspondent (jamais d'ambigu).
// Une ligne Sheet ne sert qu'une fois ; en cas de doublon de nom côté Sheet (lignes
// re-poussées), la DERNIÈRE occurrence gagne (la plus récente, en bas du tableau).

export interface LigneSheetLite {
  client: string;
  date: string;
  heure: string;
  nomTech: string;
  installation: string;
}

export interface ClientLite {
  id: string;
  raisonSociale: string;
  zohoNomSheet: string | null;
}

export interface Appariement {
  clientId: string;
  ligne: LigneSheetLite;
  nomSheet: string;
}

export interface ResultatRapprochement {
  apparies: Appariement[];
  lignesInconnues: string[]; // noms Sheet sans client
}

// "S31- ART PHOTO LAB" → "ART PHOTO LAB" ; casse et espaces multiples ignorés.
export function normaliserNomSheet(nom: string): string {
  return nom
    .replace(/^S\d+\s*-\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function rapprocherLignes(
  lignes: LigneSheetLite[],
  clients: ClientLite[]
): ResultatRapprochement {
  // Doublons Sheet: la dernière occurrence d'un même nom gagne.
  const parNomExact = new Map<string, LigneSheetLite>();
  for (const l of lignes) parNomExact.set(l.client, l);

  const restantes = new Map(parNomExact);
  const apparies: Appariement[] = [];

  // 1. Nom mémorisé.
  for (const c of clients) {
    if (c.zohoNomSheet && restantes.has(c.zohoNomSheet)) {
      apparies.push({ clientId: c.id, ligne: restantes.get(c.zohoNomSheet)!, nomSheet: c.zohoNomSheet });
      restantes.delete(c.zohoNomSheet);
    }
  }
  const dejaApparies = new Set(apparies.map((a) => a.clientId));

  // 2. Égalité normalisée.
  const clientsRestants = clients.filter((c) => !dejaApparies.has(c.id));
  const parNorme = new Map<string, string[]>(); // norme -> noms Sheet
  for (const nom of restantes.keys()) {
    const n = normaliserNomSheet(nom);
    parNorme.set(n, [...(parNorme.get(n) ?? []), nom]);
  }
  for (const c of clientsRestants) {
    const norme = normaliserNomSheet(c.raisonSociale);
    const noms = parNorme.get(norme);
    if (noms && noms.length === 1 && restantes.has(noms[0])) {
      apparies.push({ clientId: c.id, ligne: restantes.get(noms[0])!, nomSheet: noms[0] });
      restantes.delete(noms[0]);
      dejaApparies.add(c.id);
    }
  }

  // 3. Préfixe, seulement si correspondance unique dans les deux sens.
  for (const c of clients.filter((x) => !dejaApparies.has(x.id))) {
    const normeClient = normaliserNomSheet(c.raisonSociale);
    const candidats = [...restantes.keys()].filter((nom) => {
      const n = normaliserNomSheet(nom);
      return n.startsWith(normeClient) || normeClient.startsWith(n);
    });
    if (candidats.length !== 1) continue;
    const nomSheet = candidats[0];
    const normeSheet = normaliserNomSheet(nomSheet);
    const clientsCandidats = clients.filter((x) => {
      if (dejaApparies.has(x.id)) return false;
      const n = normaliserNomSheet(x.raisonSociale);
      return normeSheet.startsWith(n) || n.startsWith(normeSheet);
    });
    if (clientsCandidats.length !== 1) continue;
    apparies.push({ clientId: c.id, ligne: restantes.get(nomSheet)!, nomSheet });
    restantes.delete(nomSheet);
    dejaApparies.add(c.id);
  }

  return { apparies, lignesInconnues: [...restantes.keys()] };
}

// "12/08/2026" → Date, sinon null (valeur vide ou illisible: on ne touche pas l'app).
export function parseDateSheet(brut: string): Date | null {
  const m = brut.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) ? null : d;
}
