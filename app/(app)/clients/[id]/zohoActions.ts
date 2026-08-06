"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ajouterLigneSheet } from "@/lib/zoho/zohoClient";
import { journaliser } from "@/lib/activite";
import {
  extraireCodePostal,
  prefixeSemaine,
  statutSheetPourEtape,
} from "@/lib/domain/zoho/suiviSheet";

// Mapping Everlink → colonnes du Zoho Sheet "TABLEAU SUIVI COMMANDES". Les clés doivent
// correspondre EXACTEMENT aux en-têtes de la 1re ligne de l'onglet (espaces de fin compris,
// vérifiés sur l'export du classeur). La ligne part complète, au format des ADV :
// client préfixé de la semaine de pose, statut au vocabulaire du Sheet (leur code couleur
// est une mise en forme conditionnelle sur la colonne INSTALLATION). IMPE, MATERIEL RECU,
// N° CHRONO et INFOS FACTURATION restent à la main des ADV.
function construireRecord(c: {
  raisonSociale: string;
  departement: string | null;
  adresse: string | null;
  scenario: string | null;
  dateIntervention: Date | null;
  creneauIntervention: string | null;
  commentaire: string | null;
  referenceClient: string | null;
  contactNom: string | null;
  contactPrenom: string | null;
  etapeLibelle: string | null;
  prestataireNom: string | null;
  technicienNom: string | null;
  statutSuivi: string | null;
  dateImperative: Date | null;
  materielRecu: string | null;
  numeroChrono: string | null;
  infosFacturation: string | null;
}): Record<string, string> {
  return {
    IMPE: c.dateImperative ? c.dateImperative.toLocaleDateString("fr-FR") : "",
    CLIENT: `${prefixeSemaine(c.dateIntervention)}${c.raisonSociale}`,
    DPT: c.departement ?? "",
    "CP CLIENT ": extraireCodePostal(c.adresse),
    // Les dossiers gérés par GC pour Everlink portent le partenaire "EVERLINK".
    PARTE: "EVERLINK",
    DATE: c.dateIntervention ? c.dateIntervention.toLocaleDateString("fr-FR") : "",
    "PORTA ET COMMENTAIRES IMPORTANT ": [c.scenario, c.referenceClient]
      .filter(Boolean)
      .join(" — "),
    "HEURE ": c.creneauIntervention ?? "",
    TECH: c.prestataireNom ?? "",
    "NOM TECH": c.technicienNom ?? "",
    "NOM CP ": [c.contactPrenom, c.contactNom].filter(Boolean).join(" "),
    // Le statut saisi par les ADV prime ; sinon on le dérive de l'étape de migration.
    INSTALLATION: c.statutSuivi ?? statutSheetPourEtape(c.etapeLibelle),
    "COMMENTAIRES PLANIF ": c.commentaire ?? "",
    "MATERIEL RECU ": c.materielRecu ?? "",
    "N° CHRONO ": c.numeroChrono ?? "",
    "INFOS FACTURATION ": c.infosFacturation ?? "",
  };
}

export async function pousserVersZohoAction(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      etapeMigration: { select: { libelle: true } },
      technicien: { select: { nom: true, prestataire: { select: { nom: true } } } },
    },
  });
  if (!client) return { success: false, error: "Client introuvable." };

  const record = construireRecord({
    raisonSociale: client.raisonSociale,
    departement: client.departement,
    adresse: client.adresse,
    scenario: client.scenario,
    dateIntervention: client.dateIntervention,
    creneauIntervention: client.creneauIntervention,
    commentaire: client.commentaire,
    referenceClient: client.referenceClient,
    contactNom: client.contactNom,
    contactPrenom: client.contactPrenom,
    etapeLibelle: client.etapeMigration?.libelle ?? null,
    prestataireNom: client.technicien?.prestataire?.nom ?? null,
    technicienNom: client.technicien?.nom ?? null,
    statutSuivi: client.statutSuivi,
    dateImperative: client.dateImperative,
    materielRecu: client.materielRecu,
    numeroChrono: client.numeroChrono,
    infosFacturation: client.infosFacturation,
  });

  const r = await ajouterLigneSheet(record);
  if (!r.success) return r;

  await prisma.client.update({
    where: { id: clientId },
    data: { zohoLignePousseeLe: new Date() },
  });
  await journaliser("Client", clientId, "Poussé vers Zoho");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
