import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const motDePasse = await bcrypt.hash("changeme", 10);
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

  const listesValeurs: Array<{ categorie: string; valeur: string; ordre: number }> = [
    { categorie: "HEBERGEUR", valeur: "SEWAN", ordre: 0 },
    { categorie: "HEBERGEUR", valeur: "UNYC", ordre: 1 },
    { categorie: "STATUT_BASCULE", valeur: "À faire", ordre: 0 },
    { categorie: "STATUT_BASCULE", valeur: "Fait", ordre: 1 },
    { categorie: "SCENARIO", valeur: "Migration", ordre: 0 },
    { categorie: "TYPE_INTERVENTION", valeur: "Sur site", ordre: 0 },
    { categorie: "TYPE_INTERVENTION", valeur: "À distance", ordre: 1 },
    { categorie: "STATUT_MONDAY", valeur: "En cours", ordre: 0 },
    { categorie: "STATUT_MONDAY", valeur: "Terminé", ordre: 1 },
    { categorie: "TECHNO_LIEN", valeur: "Fibre", ordre: 0 },
    { categorie: "TECHNO_LIEN", valeur: "ADSL", ordre: 1 },
  ];
  for (const l of listesValeurs) {
    await prisma.listeValeur.upsert({
      where: { categorie_valeur: { categorie: l.categorie as never, valeur: l.valeur } },
      update: {},
      create: { categorie: l.categorie as never, valeur: l.valeur, ordre: l.ordre },
    });
  }

  const modeles: Array<{ libelle: string; marque: string; eligibleExport: boolean }> = [
    { libelle: "Yealink T57W", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W73H", marque: "Yealink", eligibleExport: true },
    { libelle: "Yealink W90B", marque: "Yealink", eligibleExport: true },
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
      create: { libelle: m.libelle, marque: m.marque, eligibleExport: m.eligibleExport },
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
