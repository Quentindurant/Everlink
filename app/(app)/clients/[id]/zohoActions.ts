"use server";

// Push d'un dossier vers le tableau de suivi maison (https://suivie.appgcd.fr), qui
// remplace le Zoho Sheet. Le nom de l'action est conservé (pousserVersZohoAction) pour ne
// pas toucher les composants qui l'appellent (BoutonZoho, GestionDossiers).
//
// Le mapping dossier → 16 colonnes du tableau vit dans lib/domain/suivi/ligneSuivi
// (construireDonneesLigne). La ligne part dans le mois de la date d'intervention (sinon le
// mois courant), au format des ADV : client préfixé de la semaine de pose, statut au
// vocabulaire du tableau. L'API impose une création en deux temps : POST /rows {month}
// (ligne vide) puis PATCH des cellules avec la version fraîchement créée.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import { construireDonneesLigne, moisDuDossier } from "@/lib/domain/suivi/ligneSuivi";
import { suiviClient, suiviConfig } from "@/lib/suivi/suiviClient";

export async function pousserVersZohoAction(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  if (!suiviConfig().configure) {
    return { success: false, error: "Tableau de suivi non configuré (variables SUIVI_API_* manquantes)." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      etapeMigration: { select: { libelle: true } },
      technicien: { select: { nom: true, prestataire: { select: { nom: true } } } },
    },
  });
  if (!client) return { success: false, error: "Client introuvable." };

  const donnees = construireDonneesLigne({
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

  try {
    const c = suiviClient();
    const ligne = await c.creerLigne(moisDuDossier(client.dateIntervention));
    const r = await c.patcherLigne(ligne.id, ligne.version, donnees);
    if (!r.success) return { success: false, error: r.error };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Échec du push vers le tableau de suivi." };
  }

  await prisma.client.update({
    where: { id: clientId },
    data: {
      zohoLignePousseeLe: new Date(),
      // Mémorise le nom exact poussé : le pull rapprochera ce dossier immédiatement
      // (priorité 1 du rapprochement), même si les ADV renomment plus tard.
      zohoNomSheet: donnees.client ?? client.raisonSociale,
    },
  });
  await journaliser("Client", clientId, "Poussé vers le tableau de suivi");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
