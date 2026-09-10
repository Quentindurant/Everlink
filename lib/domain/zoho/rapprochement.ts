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
  /** Département de l'intervention (colonne dpt) : départage deux sites du même client. */
  dpt: string;
  date: string;
  heure: string;
  nomTech: string;
  /** Chef de projet GC (colonne nom_cp) : destinataire des alertes prestataires. */
  nomCp: string;
  installation: string;
}

export interface ClientLite {
  id: string;
  raisonSociale: string;
  zohoNomSheet: string | null;
  departement: string | null;
}

/** "78", " 078 ", "78 " → "78". Un département vide ne départage rien. */
function normaliserDepartement(brut: string | null): string {
  return (brut ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").trim();
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

// Clé de comparaison entre les deux côtés, qui n'écrivent pas les noms pareil : l'app tient
// « AQUADOUCE SERVICE / LES TERRES ESSENTIELLES » là où le tableau écrit « … - LES TERRES
// ESSENTIELLES », et les apostrophes, arobases ou parenthèses d'un nom commercial varient
// d'une saisie à l'autre (« TOD'S », « ANGLAIS @ ANTONY »). On ne garde donc que les lettres
// et les chiffres : ni ponctuation ni espaces, qui sont précisément ce qui diffère. Deux
// clients réellement distincts se distinguent par leurs mots, pas par leurs tirets.
export function cleComparaison(nom: string): string {
  return normaliserNomSheet(nom)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Z]/gi, "")
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
  const parNorme = new Map<string, string[]>(); // clé -> noms Sheet
  for (const nom of restantes.keys()) {
    const n = cleComparaison(nom);
    parNorme.set(n, [...(parNorme.get(n) ?? []), nom]);
  }
  for (const c of clientsRestants) {
    const norme = cleComparaison(c.raisonSociale);
    const noms = parNorme.get(norme);
    if (noms && noms.length === 1 && restantes.has(noms[0])) {
      apparies.push({ clientId: c.id, ligne: restantes.get(noms[0])!, nomSheet: noms[0] });
      restantes.delete(noms[0]);
      dejaApparies.add(c.id);
    }
  }

  // 3. Préfixe, seulement si correspondance unique dans les deux sens.
  for (const c of clients.filter((x) => !dejaApparies.has(x.id))) {
    const normeClient = cleComparaison(c.raisonSociale);
    const candidats = [...restantes.keys()].filter((nom) => {
      const n = cleComparaison(nom);
      return n.startsWith(normeClient) || normeClient.startsWith(n);
    });
    // Un client, plusieurs sites au tableau : le département tranche quand il ne désigne
    // qu'une seule ligne. Sans lui on renonçait, et le dossier restait sans date ni statut.
    const retenus = candidats.length > 1 ? parDepartement(candidats, c, restantes) : candidats;
    if (retenus.length !== 1) continue;
    const nomSheet = retenus[0];
    const normeSheet = cleComparaison(nomSheet);
    const clientsCandidats = clients.filter((x) => {
      if (dejaApparies.has(x.id)) return false;
      const n = cleComparaison(x.raisonSociale);
      return normeSheet.startsWith(n) || n.startsWith(normeSheet);
    });
    if (clientsCandidats.length !== 1) continue;
    apparies.push({ clientId: c.id, ligne: restantes.get(nomSheet)!, nomSheet });
    restantes.delete(nomSheet);
    dejaApparies.add(c.id);
  }

  // 4. Mots communs dans le même département : les ADV écrivent le site autrement que l'app.
  for (const c of clients.filter((x) => !dejaApparies.has(x.id))) {
    const nomSheet = meilleureParMots(c, restantes);
    if (!nomSheet) continue;
    // Réciprocité : cette ligne doit elle aussi désigner ce dossier plutôt qu'un autre.
    const retour = [...clients.filter((x) => !dejaApparies.has(x.id))]
      .map((x) => ({ x, score: similarite(x.raisonSociale, nomSheet) }))
      .sort((a, b) => b.score - a.score);
    if (retour[0].x.id !== c.id) continue;
    if (retour.length > 1 && retour[1].score === retour[0].score) continue;
    apparies.push({ clientId: c.id, ligne: restantes.get(nomSheet)!, nomSheet });
    restantes.delete(nomSheet);
    dejaApparies.add(c.id);
  }

  return { apparies, lignesInconnues: [...restantes.keys()] };
}

// "12/08/2026" → Date, sinon null (valeur vide ou illisible: on ne touche pas l'app).
/**
 * Proportion minimale de mots communs pour reconnaître deux écritures d'un même dossier.
 *
 * Mesuré sur les 91 dossiers de production : à 0,6 deux paires de sites distincts se
 * touchent (« L'ENFANT BLEU LILLE » et « … PACA », « APEF SMJ SERVICES COURBEVOIE » et
 * « … LA GARENNE ») ; à 0,7 plus aucune. Le seuil est donc calé sur les données réelles.
 */
const SIMILARITE_MINIMALE = 0.7;

/** Mots significatifs d'un nom : accents et ponctuation retirés, mots d'une lettre ignorés. */
function mots(nom: string): Set<string> {
  return new Set(
    normaliserNomSheet(nom)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^0-9A-Za-z]+/)
      .filter((m) => m.length > 1)
      .map((m) => m.toUpperCase())
  );
}

// Part de mots communs, rapportée au nom le plus long : « AMBULANCES NOUVELLES STEPHENSON
// BOULOGNE » et « … ODESEINE » partagent trois mots sur quatre. Rapporter au plus long évite
// qu'un nom court se fonde dans un nom long qui le contient.
function similarite(a: string, b: string): number {
  const ma = mots(a);
  const mb = mots(b);
  if (ma.size === 0 || mb.size === 0) return 0;
  let communs = 0;
  for (const m of ma) if (mb.has(m)) communs++;
  return communs / Math.max(ma.size, mb.size);
}

// Parmi des lignes qui portent toutes le nom du client, celles de son département. Renvoie
// les candidats inchangés si le département ne départage pas — mieux vaut ne rien apparier
// que d'écraser le statut du mauvais site à chaque synchronisation.
function parDepartement(
  candidats: string[],
  client: ClientLite,
  restantes: Map<string, LigneSheetLite>
): string[] {
  const dept = normaliserDepartement(client.departement);
  if (!dept) return candidats;
  const memeDept = candidats.filter(
    (nom) => normaliserDepartement(restantes.get(nom)?.dpt ?? "") === dept
  );
  return memeDept.length === 1 ? memeDept : candidats;
}

/**
 * Dernier recours : la ligne dont le nom partage assez de mots avec celui du dossier, dans
 * son département. Les ADV écrivent le site autrement que l'app — « - BOULOGNE » d'un côté,
 * « - ODESEINE » de l'autre — et aucune règle sur les préfixes ne peut les relier.
 *
 * Trois garde-fous : le département doit correspondre, la similarité dépasser le seuil, et
 * la meilleure ligne être seule à ce niveau. Une égalité laisse le dossier non apparié : le
 * rapprochement manuel existe pour ça, et un mauvais lien écraserait le statut du voisin à
 * chaque passage du cron.
 */
function meilleureParMots(
  client: ClientLite,
  restantes: Map<string, LigneSheetLite>
): string | null {
  const dept = normaliserDepartement(client.departement);

  const scores = [...restantes.entries()]
    // Le département exclut plutôt qu'il ne conditionne : deux départements connus et
    // différents, ce sont deux sites. Mais beaucoup de dossiers n'en ont pas, et exiger
    // le département les privait de tout rapprochement.
    .filter(([, l]) => {
      const dl = normaliserDepartement(l.dpt);
      return !dept || !dl || dl === dept;
    })
    .map(([nom]) => ({ nom, score: similarite(client.raisonSociale, nom) }))
    .filter((x) => x.score >= SIMILARITE_MINIMALE)
    .sort((a, b) => b.score - a.score);

  if (scores.length === 0) return null;
  if (scores.length > 1 && scores[1].score === scores[0].score) return null;
  return scores[0].nom;
}

export function parseDateSheet(brut: string): Date | null {
  const m = brut.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) ? null : d;
}
