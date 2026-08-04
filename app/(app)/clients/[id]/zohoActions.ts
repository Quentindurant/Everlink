"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ajouterLigneSheet } from "@/lib/zoho/zohoClient";

// Mapping Everlink → colonnes du Zoho Sheet "TABLEAU SUIVI COMMANDES". Les clés doivent
// correspondre EXACTEMENT aux en-têtes de la 1re ligne de l'onglet. À ajuster après le 1er test
// live si Zoho renvoie une erreur de colonne inconnue.
function construireRecord(c: {
  raisonSociale: string;
  departement: string | null;
  dateIntervention: Date | null;
  creneauIntervention: string | null;
  commentaire: string | null;
  referenceClient: string | null;
  etapeLibelle: string | null;
  prestataireNom: string | null;
  technicienNom: string | null;
}): Record<string, string> {
  // Noms de colonnes EXACTS de la feuille (certains ont un espace en fin, vérifié via l'API).
  return {
    CLIENT: c.raisonSociale,
    DPT: c.departement ?? "",
    // Les dossiers gérés par GC pour Everlink portent le partenaire "EVERLINK".
    PARTE: "EVERLINK",
    DATE: c.dateIntervention ? c.dateIntervention.toLocaleDateString("fr-FR") : "",
    "HEURE ": c.creneauIntervention ?? "",
    "PORTA ET COMMENTAIRES IMPORTANT ": [c.referenceClient, c.commentaire].filter(Boolean).join(" — "),
    TECH: c.prestataireNom ?? "",
    "NOM TECH": c.technicienNom ?? "",
    INSTALLATION: c.etapeLibelle ?? "",
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
    dateIntervention: client.dateIntervention,
    creneauIntervention: client.creneauIntervention,
    commentaire: client.commentaire,
    referenceClient: client.referenceClient,
    etapeLibelle: client.etapeMigration?.libelle ?? null,
    prestataireNom: client.technicien?.prestataire?.nom ?? null,
    technicienNom: client.technicien?.nom ?? null,
  });

  const r = await ajouterLigneSheet(record);
  if (!r.success) return r;

  await prisma.client.update({
    where: { id: clientId },
    data: { zohoLignePousseeLe: new Date() },
  });
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
