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
