"use server";

// Push d'un dossier vers le tableau de suivi maison (https://suivie.appgcd.fr), qui
// remplace le Zoho Sheet. Le nom de l'action est conservé (pousserVersZohoAction) pour ne
// pas toucher les composants qui l'appellent (BoutonZoho, GestionDossiers).
//
// Le mapping dossier → 16 colonnes du tableau vit dans lib/domain/suivi/ligneSuivi
// (construireDonneesLigne). La ligne part dans le mois de la date d'intervention (sinon le
// mois courant), au format des ADV : client préfixé de la semaine de pose, statut au
// vocabulaire du tableau.
//
// Le push est un UPSERT : si la ligne du dossier existe déjà dans le mois cible
// (trouverLigneCible, nom normalisé, priorité au nom mémorisé zohoNomSheet), on la PATCH ;
// sinon l'API impose une création en deux temps : POST /rows {month} (ligne vide) puis
// PATCH des cellules avec la version fraîchement créée.

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/activite";
import {
  construireDonneesLigne,
  libelleMoisSuivi,
  moisDuDossier,
  trouverLigneCible,
} from "@/lib/domain/suivi/ligneSuivi";
import { suiviClient, suiviConfig, type SuiviClient } from "@/lib/suivi/suiviClient";

/**
 * Le push est en deux temps (POST ligne vide puis PATCH des cellules) : si le PATCH
 * échoue, la ligne vide resterait visible chez les ADV et chaque nouvel essai en
 * créerait une autre. Compensation au mieux — un échec de la suppression elle-même
 * n'a pas à masquer l'erreur d'origine.
 */
async function effacerLigneOrpheline(c: SuiviClient, id: string): Promise<void> {
  try {
    await c.supprimerLigne(id);
  } catch {
    // au mieux : l'erreur du PATCH reste celle remontée à l'utilisateur
  }
}

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

  const mois = moisDuDossier(client.dateIntervention);
  try {
    const c = suiviClient();
    // Upsert : re-pousser un dossier met à jour SA ligne au lieu d'empiler un doublon.
    // Si la date d'intervention a changé de mois, on ne cherche QUE dans le nouveau mois :
    // l'éventuelle ligne restée dans l'ancien mois n'est ni déplacée ni supprimée (choix
    // assumé — l'historique mensuel appartient aux ADV, le ménage se fait côté tableau).
    const cible = trouverLigneCible(
      await c.lireLignesMois(mois),
      client.zohoNomSheet,
      donnees.client ?? client.raisonSociale
    );

    if (cible.type === "ambigu") {
      // Plusieurs lignes portent déjà ce nom : écrire au hasard ou créer une énième ligne
      // aggraverait le doublon. On rend la main sans rien toucher.
      return {
        success: false,
        error:
          `${cible.nombre} lignes correspondent à ce client dans le tableau ` +
          `(mois ${libelleMoisSuivi(mois)}) : fusionnez-les côté tableau avant de repousser.`,
      };
    }

    if (cible.type === "unique") {
      // Mise à jour de la ligne existante. construireDonneesLigne omet les champs vides :
      // une cellule remplie par les ADV n'est jamais écrasée par du vide.
      const r = await c.patcherLigne(cible.ligne.id, cible.ligne.version, donnees);
      if (!r.success) return { success: false, error: r.error };
    } else {
      // Absente : création en deux temps, avec compensation de la ligne orpheline.
      const ligne = await c.creerLigne(mois);
      try {
        const r = await c.patcherLigne(ligne.id, ligne.version, donnees);
        if (!r.success) {
          await effacerLigneOrpheline(c, ligne.id);
          return { success: false, error: r.error };
        }
      } catch (e) {
        await effacerLigneOrpheline(c, ligne.id);
        throw e;
      }
    }
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
