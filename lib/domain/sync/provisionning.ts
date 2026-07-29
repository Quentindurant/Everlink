export const PROVISIONNING_HEADERS = [
  "Client (raison sociale)",
  "Numéro à porter",
  "Numéro court",
  "Contrôle N°",
  "Equipement",
  "Adresse MAC équipement",
  "Utilisateur",
  "Hébergeur source",
  "Hébergeur cible",
  "Bascule des numéros",
  "Date bascule",
  "Commentaires",
];

export interface ProvisionningNumeroRow {
  clientRaisonSociale: string;
  numeroBrut: string;
  numerosCourts: string[];
  controleNiveau: "OK" | "AVERTISSEMENT" | "ERREUR";
  equipementModeleLibelle: string | null;
  equipementMacBrut: string | null;
  utilisateurNom: string | null;
  hebergeurSource: string;
  hebergeurCible: string;
  statutBascule: string;
  dateBascule: Date | null;
  commentaire: string | null;
}

export interface ProvisionningEquipementRow {
  clientRaisonSociale: string;
  equipementModeleLibelle: string | null;
  equipementMacBrut: string;
  commentaire: string | null;
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function buildProvisionningRows(
  numeros: ProvisionningNumeroRow[],
  equipementsOrphelins: ProvisionningEquipementRow[]
): string[][] {
  const numeroRows = numeros.map((n) => [
    n.clientRaisonSociale,
    n.numeroBrut,
    n.numerosCourts.join("/"),
    n.controleNiveau,
    n.equipementModeleLibelle ?? "",
    n.equipementMacBrut ?? "",
    n.utilisateurNom ?? "",
    n.hebergeurSource,
    n.hebergeurCible,
    n.statutBascule,
    formatDate(n.dateBascule),
    n.commentaire ?? "",
  ]);

  const equipementRows = equipementsOrphelins.map((e) => [
    e.clientRaisonSociale,
    "",
    "",
    "",
    e.equipementModeleLibelle ?? "",
    e.equipementMacBrut,
    "",
    "",
    "",
    "",
    "",
    e.commentaire ?? "",
  ]);

  return [...numeroRows, ...equipementRows];
}
