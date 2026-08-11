import { PrismaClient, CategorieListe } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
// Le seed tourne aussi en production: un mot de passe ADMIN en dur dans le dépôt serait un
// identifiant public. Pas de valeur par défaut, l'échec est volontaire.
if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error("SEED_ADMIN_PASSWORD is not set");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const motDePasse = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD as string, 10);
  await prisma.utilisateurApp.upsert({
    where: { email: "admin@everlink.local" },
    update: {},
    create: {
      email: "admin@everlink.local",
      nom: "Administrateur",
      motDePasse,
      role: "ADMIN",
    },
  });

  const listesValeurs: Array<{ categorie: CategorieListe; valeur: string; ordre: number }> = [
    { categorie: "HEBERGEUR", valeur: "SEWAN", ordre: 0 },
    { categorie: "HEBERGEUR", valeur: "UNYC", ordre: 1 },
    { categorie: "STATUT_BASCULE", valeur: "À faire", ordre: 0 },
    { categorie: "STATUT_BASCULE", valeur: "En cours", ordre: 1 },
    { categorie: "STATUT_BASCULE", valeur: "Fait", ordre: 2 },
    { categorie: "STATUT_BASCULE", valeur: "Bloqué", ordre: 3 },
    { categorie: "STATUT_ETAPE", valeur: "À faire", ordre: 0 },
    { categorie: "STATUT_ETAPE", valeur: "En cours", ordre: 1 },
    { categorie: "STATUT_ETAPE", valeur: "Fait", ordre: 2 },
    { categorie: "STATUT_ETAPE", valeur: "Sans objet", ordre: 3 },
    // « Aucun » = l'étape ne s'applique pas au poste ; compté comme résolu dans les jauges.
    { categorie: "STATUT_ETAPE", valeur: "Aucun", ordre: 4 },
    { categorie: "SCENARIO", valeur: "CENTREX only", ordre: 0 },
    { categorie: "SCENARIO", valeur: "Lien + CENTREX", ordre: 1 },
    { categorie: "SCENARIO", valeur: "Lien + CENTREX + 4G/5G", ordre: 2 },
    { categorie: "TYPE_INTERVENTION", valeur: "Sur site", ordre: 0 },
    { categorie: "TYPE_INTERVENTION", valeur: "A distance", ordre: 1 },
    { categorie: "STATUT_MONDAY", valeur: "New", ordre: 0 },
    { categorie: "STATUT_MONDAY", valeur: "En cours", ordre: 1 },
    { categorie: "STATUT_MONDAY", valeur: "Terminé", ordre: 2 },
    { categorie: "TECHNO_LIEN", valeur: "FTTH", ordre: 0 },
    { categorie: "TECHNO_LIEN", valeur: "FTTO", ordre: 1 },
    { categorie: "TECHNO_LIEN", valeur: "Copper", ordre: 2 },
    { categorie: "TECHNO_LIEN", valeur: "FTTH + 4G/5G", ordre: 3 },
    { categorie: "TECHNO_LIEN", valeur: "NC", ordre: 4 },
  ];
  for (const l of listesValeurs) {
    await prisma.listeValeur.upsert({
      where: { categorie_valeur: { categorie: l.categorie, valeur: l.valeur } },
      update: {},
      create: { categorie: l.categorie, valeur: l.valeur, ordre: l.ordre },
    });
  }

  const modeles: Array<{ libelle: string; marque: string; eligibleExport: boolean; alias?: string[] }> = [
    { libelle: "Yealink T57W", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W73H", marque: "Yealink", eligibleExport: true, alias: ["Yealink w73H"] },
    { libelle: "Yealink W90B", marque: "Yealink", eligibleExport: true, alias: ["Yealnik w90B"] },
    { libelle: "Yealink W90DM", marque: "Yealink", eligibleExport: true },
    { libelle: "Panasonic TGP500", marque: "Panasonic", eligibleExport: false },
    { libelle: "Panasonic TGP600", marque: "Panasonic", eligibleExport: false },
    { libelle: "Polycom VVX400", marque: "Polycom", eligibleExport: false },
    { libelle: "Polycom IP5000", marque: "Polycom", eligibleExport: false },
    { libelle: "Polycom RealPresence Trio 8300", marque: "Polycom", eligibleExport: false },
    { libelle: "DOKO", marque: "DOKO", eligibleExport: false },
    { libelle: "FAX", marque: "FAX", eligibleExport: false },
    { libelle: "Aastra", marque: "Aastra", eligibleExport: false },
  ];
  for (const m of modeles) {
    await prisma.modeleEquipement.upsert({
      where: { libelle: m.libelle },
      update: {},
      create: { libelle: m.libelle, marque: m.marque, eligibleExport: m.eligibleExport, alias: m.alias ?? [] },
    });
  }

  // Étapes de suivi téléphonie (SPEC §3.3). Ce sont des données éditables depuis Paramètres,
  // seedées ici pour que la page Téléphone soit exploitable dès l'installation.
  const etapes = [
    "Créer les utilisateurs",
    "Mettre les équipements sur les utilisateurs",
    "Mettre les BLF et raccourcis",
    "Récupérer messages SVI, PRÉDÉCROCHÉ, ATTENTE, RÉPONDEUR",
    "Configurer groupes d'appel, SVI, routes d'appel",
    "Vérifier l'annuaire",
  ];
  for (const [ordre, libelle] of etapes.entries()) {
    await prisma.etapeModele.upsert({
      where: { libelle },
      update: {},
      create: { libelle, ordre },
    });
  }

  // Étapes du parcours de migration client. Éditables depuis Paramètres.
  const etapesMigration: Array<{ libelle: string; couleur: string; estBloquant: boolean }> = [
    { libelle: "À qualifier", couleur: "#98a2b3", estBloquant: false },
    { libelle: "Prévenance envoyée", couleur: "#1f6bff", estBloquant: false },
    { libelle: "Contact en cours", couleur: "#00b8cc", estBloquant: false },
    { libelle: "Bloqué", couleur: "#f04438", estBloquant: true },
    { libelle: "RDV planifié", couleur: "#8a5bff", estBloquant: false },
    { libelle: "Lien livré", couleur: "#ffb020", estBloquant: false },
    { libelle: "Bascule faite", couleur: "#16b57f", estBloquant: false },
    { libelle: "Post-migration J+7", couleur: "#0e7a56", estBloquant: false },
  ];
  for (const [ordre, e] of etapesMigration.entries()) {
    await prisma.etapeMigration.upsert({
      where: { libelle: e.libelle },
      update: {},
      create: { libelle: e.libelle, ordre, couleur: e.couleur, estBloquant: e.estBloquant },
    });
  }

  // Modèles de mail (doc Templates_Communication_Migration_v3.5). Crochets convertis en
  // variables {...}. Éditables ensuite dans Paramètres.
  const SIGNATURE =
    "\n\nNous vous remercions pour votre confiance et restons à votre disposition.\nCordialement,\n\nPôle migration — Everlink Services\nmigration.ext@everlink-services.fr | www.everlink-services.fr";

  const modelesMail: Array<{
    scenario: string;
    type: "PREVENANCE" | "CONFIRMATION";
    objet: string;
    corps: string;
  }> = [
    {
      scenario: "Centrex + FTTH — sur site",
      type: "PREVENANCE",
      objet: "[EVERLINK] - Évolution de vos services téléphonie et internet",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Dans le cadre de l'amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l'infrastructure technique qui assure vos services de téléphonie (Centrex) et d'accès internet (fibre).\n\n" +
        "Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance. Il s'agit d'une opération simple et rapide, qui n'aura pas d'impact sur votre activité.\n\n" +
        "Ce que cela implique pour vous :\n" +
        "- Aucun changement de vos numéros de téléphone\n" +
        "- Aucuns travaux : seul votre routeur sera remplacé. Vos téléphones actuels ne sont pas changés.\n" +
        "- Une intervention sur votre site sera nécessaire. Celle-ci sera planifiée avec vous en amont afin d'installer un nouveau routeur, de procéder à la bascule de votre accès Internet et de reconfigurer vos téléphones.\n\n" +
        "Vos prestataires tiers : si certains de vos équipements sont connectés à votre accès Internet et gérés par des prestataires externes (alarme, vidéosurveillance, contrôle d'accès, pare-feu, etc.), nous vous remercions de préparer la liste de ces prestataires ainsi que leurs coordonnées. Ces informations seront recueillies lors de notre prochain appel de planification.\n\n" +
        "Notre équipe vous contactera très prochainement afin de convenir d'une date d'intervention.\nPour toute question : migration.ext@everlink-services.fr" +
        SIGNATURE,
    },
    {
      scenario: "Centrex + FTTH — sur site",
      type: "CONFIRMATION",
      objet: "[EVERLINK] - Confirmation de votre rendez-vous — Migration de vos services {nom_client}",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Comme convenu lors de notre échange, nous vous confirmons la planification de l'intervention nécessaire à la migration de vos services de téléphonie et Internet. Il s'agit d'une opération simple : un seul rendez-vous, réunissant l'intervention de l'opérateur et celle du technicien.\n\n" +
        "Rendez-vous avec l'opérateur et le technicien — livraison du lien et bascule des équipements (durée 4h)\n" +
        "Date : {date}  |  Créneau : {creneau}\n" +
        "Lieu d'intervention : {adresse}\n\n" +
        "Prérequis à préparer avant l'intervention :\n" +
        "- Accès libre au local technique / à la baie où sont installés vos équipements actuels\n" +
        "- Accès libre au local technique où arrive la fibre (point de livraison FTTH)\n" +
        "- Présence d'une personne habilitée sur site pendant toute la durée du rendez-vous\n\n" +
        "Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d'intervention, à migration.ext@everlink-services.fr ou au {numero_gc}.\n\nCordialement,\n\nPôle migration — Everlink Services",
    },
    {
      scenario: "Centrex — sur site (sans FTTH)",
      type: "PREVENANCE",
      objet: "[EVERLINK] - Évolution de votre service de téléphonie",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Dans le cadre de l'amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l'infrastructure technique qui assure votre service de téléphonie (Centrex).\n\n" +
        "Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance.\n\n" +
        "Ce que cela implique pour vous :\n" +
        "- Aucun changement de vos numéros de téléphone\n" +
        "- Aucuns travaux : seul votre routeur sera remplacé. Vos téléphones actuels ne sont pas changés.\n" +
        "- Une intervention sur votre site sera nécessaire. Celle-ci sera planifiée avec vous en amont afin d'installer un nouveau routeur et de reconfigurer vos téléphones.\n\n" +
        "Notre équipe vous contactera très prochainement afin de convenir d'une date d'intervention.\nPour toute question : migration.ext@everlink-services.fr" +
        SIGNATURE,
    },
    {
      scenario: "Centrex — sur site (sans FTTH)",
      type: "CONFIRMATION",
      objet: "[EVERLINK] - Confirmation de votre rendez-vous — Migration de votre téléphonie {nom_client}",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Comme convenu lors de notre échange, nous vous confirmons la planification de l'intervention nécessaire à la migration de votre service de téléphonie.\n\n" +
        "Rendez-vous technicien — bascule de votre ligne téléphonique (durée 2h)\n" +
        "Date : {date}  |  Créneau : {creneau}\n" +
        "Lieu d'intervention : {adresse}\n\n" +
        "Prérequis à préparer avant l'intervention :\n" +
        "- Accès libre à l'emplacement de vos équipements téléphoniques actuels\n" +
        "- Présence d'une personne habilitée sur site pendant toute la durée du rendez-vous\n\n" +
        "Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d'intervention, à migration.ext@everlink-services.fr ou au {numero_gc}.\n\nCordialement,\n\nPôle migration — Everlink Services",
    },
    {
      scenario: "Centrex — à distance",
      type: "PREVENANCE",
      objet: "[EVERLINK] - Évolution de votre service de téléphonie",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Dans le cadre de l'amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l'infrastructure technique qui assure votre service de téléphonie (Centrex).\n\n" +
        "Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance. Pour votre confort, cette migration pourra être réalisée entièrement à distance, sans déplacement sur site.\n\n" +
        "Ce que cela implique pour vous :\n" +
        "- Aucun changement de vos numéros de téléphone\n" +
        "- Aucuns travaux : aucune intervention physique sur vos installations n'est nécessaire.\n" +
        "- La migration sera effectuée à distance par nos équipes techniques. La présence d'un interlocuteur sur site sera toutefois requise le jour de l'intervention afin d'accompagner la reconfiguration des téléphones.\n\n" +
        "Notre équipe vous contactera très prochainement afin de convenir d'une date et de confirmer le contact technique présent sur site le jour de l'opération.\nPour toute question : migration.ext@everlink-services.fr" +
        SIGNATURE,
    },
    {
      scenario: "Centrex — à distance",
      type: "CONFIRMATION",
      objet: "[EVERLINK] - Confirmation de votre rendez-vous — Migration à distance de votre téléphonie {nom_client}",
      corps:
        "Bonjour {civilite_nom},\n\n" +
        "Comme convenu lors de notre échange, nous vous confirmons la planification de la migration à distance de votre service de téléphonie.\n\n" +
        "Rendez-vous technique à distance\n" +
        "Date : {date}  |  Créneau : {creneau}\n\n" +
        "Prérequis à préparer avant l'intervention :\n" +
        "- Présence sur site, durant le créneau indiqué, d'une personne pouvant manipuler les postes téléphoniques (redémarrage, branchement)\n" +
        "- Accès aux postes téléphoniques et, si nécessaire, à leurs câbles d'alimentation et réseau\n" +
        "- Disponibilité téléphonique du contact sur site pour être guidé en direct par notre technicien\n" +
        "- Maintien de votre connexion internet actuelle en état de fonctionnement\n\n" +
        "Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d'intervention, à migration.ext@everlink-services.fr ou au {numero_gc}.\n\nCordialement,\n\nPôle migration — Everlink Services",
    },
  ];
  for (const [ordre, m] of modelesMail.entries()) {
    const existant = await prisma.modeleMail.findFirst({
      where: { scenario: m.scenario, type: m.type },
    });
    if (!existant) {
      await prisma.modeleMail.create({ data: { ...m, ordre } });
    }
  }

  // Prestataires de techniciens (réseaux). Le référentiel technicien lui-même se remplit dans
  // l'app (les données Zoho étaient trop bruitées pour un import fiable).
  const prestataires = [
    "DIRECT",
    "KRYCIA",
    "DELTINFO",
    "ADWEB",
    "SPOTER",
    "OCCITECH",
    "SOSINFO",
    "PSITEK",
    "5 COM",
    "AUTRE",
  ];
  for (const nom of prestataires) {
    await prisma.prestataire.upsert({ where: { nom }, update: {}, create: { nom } });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
