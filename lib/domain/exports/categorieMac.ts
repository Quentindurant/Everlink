// Répartition des équipements dans l'export MAC:
//  - onglet principal "Téléphonie": téléphones, pieuvres (audioconférence), bases/combinés DECT.
//  - onglet "Réseau": switchs, routeurs, box, OneAccess, routeurs 4G/LTE.
// La catégorie est déduite de la marque + du libellé du modèle (le flag eligibleExport en base
// n'est pas fiable après import). Par défaut, un modèle inconnu reste en téléphonie pour ne
// jamais perdre un équipement.

const MOTS_RESEAU = [
  "mikrotik",
  "hapac",
  "hap ac",
  "chateau",
  "château",
  "rb951",
  "rb750",
  "lte",
  "4g",
  "switch",
  "routeur",
  "router",
  "oneaccess",
  "one access",
  "one accès",
  "technicolor",
  "draytek",
  "vigor",
  "fortinet",
  "fortigate",
  "stormshield",
  "zyxel",
  "netgear",
  "tp-link",
  "tplink",
  "ubiquiti",
  "unifi",
  "sfr box",
  "livebox",
  "freebox",
  "bbox",
];

export function estEquipementReseau(marque: string | null, libelle: string | null): boolean {
  const t = `${marque ?? ""} ${libelle ?? ""}`.toLowerCase();
  return MOTS_RESEAU.some((mot) => t.includes(mot));
}
