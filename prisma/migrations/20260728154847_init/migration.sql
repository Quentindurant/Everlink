-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleApp" AS ENUM ('ADMIN', 'OPERATEUR');

-- CreateEnum
CREATE TYPE "NiveauControle" AS ENUM ('OK', 'AVERTISSEMENT', 'ERREUR');

-- CreateEnum
CREATE TYPE "TypeEquipement" AS ENUM ('POSTE_FIXE', 'COMBINE_DECT', 'BORNE_DECT', 'FAX', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeIdentifiant" AS ENUM ('MAC48', 'IPUI', 'AUTRE');

-- CreateEnum
CREATE TYPE "CategorieListe" AS ENUM ('HEBERGEUR', 'STATUT_BASCULE', 'STATUT_ETAPE', 'SCENARIO', 'TYPE_INTERVENTION', 'STATUT_MONDAY', 'TECHNO_LIEN');

-- CreateEnum
CREATE TYPE "TypeImport" AS ENUM ('MONDAY', 'SHEET');

-- CreateEnum
CREATE TYPE "TypeExport" AS ENUM ('SDA', 'MAC');

-- CreateTable
CREATE TABLE "UtilisateurApp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "RoleApp" NOT NULL DEFAULT 'OPERATEUR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilisateurApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "clos" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "cleRapprochement" TEXT NOT NULL,
    "lotId" TEXT,
    "groupe" TEXT,
    "filiale" TEXT,
    "codeMonday" TEXT,
    "scenario" TEXT,
    "adresse" TEXT,
    "dateIntervention" TIMESTAMP(3),
    "clientVip" BOOLEAN NOT NULL DEFAULT false,
    "typeIntervention" TEXT,
    "statutMonday" TEXT,
    "nbPostesAnnonce" INTEGER,
    "contactNom" TEXT,
    "contactPrenom" TEXT,
    "contactFixe" TEXT,
    "contactMobile" TEXT,
    "contactEmail" TEXT,
    "technoLien" TEXT,
    "debit" TEXT,
    "modeleCpe" TEXT,
    "departement" TEXT,
    "postesDeployesRaw" TEXT,
    "mondayRaw" JSONB,
    "hebergeurSource" TEXT NOT NULL DEFAULT 'SEWAN',
    "hebergeurCible" TEXT NOT NULL DEFAULT 'UNYC',
    "statutBascule" TEXT NOT NULL DEFAULT 'À faire',
    "dateBascule" TIMESTAMP(3),
    "commentaire" TEXT,
    "archiveA" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "commentaire" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "archiveA" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Numero" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "numeroBrut" TEXT NOT NULL,
    "numeroNormalise" TEXT NOT NULL,
    "numerosCourts" TEXT[],
    "controleNiveau" "NiveauControle" NOT NULL DEFAULT 'OK',
    "controleDetail" TEXT,
    "controleForce" BOOLEAN NOT NULL DEFAULT false,
    "controleMotif" TEXT,
    "controlePar" TEXT,
    "controleLe" TIMESTAMP(3),
    "statutBascule" TEXT NOT NULL DEFAULT 'À faire',
    "dateBascule" TIMESTAMP(3),
    "commentaire" TEXT,
    "exclureExport" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "archiveA" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Numero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeleEquipement" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "type" "TypeEquipement" NOT NULL DEFAULT 'POSTE_FIXE',
    "eligibleExport" BOOLEAN NOT NULL DEFAULT false,
    "alias" TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeleEquipement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "modeleId" TEXT,
    "modeleLibelleBrut" TEXT,
    "macBrut" TEXT NOT NULL,
    "macNormalise" TEXT NOT NULL,
    "typeIdentifiant" "TypeIdentifiant" NOT NULL DEFAULT 'MAC48',
    "commentaire" TEXT,
    "exclureExport" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "archiveA" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapeModele" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapeModele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviEtape" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "etapeId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'À faire',
    "commentaire" TEXT,
    "faitLe" TIMESTAMP(3),
    "faitPar" TEXT,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuiviEtape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeValeur" (
    "id" TEXT NOT NULL,
    "categorie" "CategorieListe" NOT NULL,
    "valeur" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeValeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "type" "TypeImport" NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "tailleOctets" INTEGER,
    "rapport" JSONB NOT NULL,
    "succes" BOOLEAN NOT NULL DEFAULT true,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "type" "TypeExport" NOT NULL,
    "lotId" TEXT,
    "filtres" JSONB NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "nbLignes" INTEGER NOT NULL,
    "contenu" JSONB NOT NULL,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "champ" TEXT,
    "avant" TEXT,
    "apres" TEXT,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UtilisateurApp_email_key" ON "UtilisateurApp"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_nom_key" ON "Lot"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_reference_key" ON "Lot"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Client_raisonSociale_key" ON "Client"("raisonSociale");

-- CreateIndex
CREATE UNIQUE INDEX "Client_codeMonday_key" ON "Client"("codeMonday");

-- CreateIndex
CREATE INDEX "Client_cleRapprochement_idx" ON "Client"("cleRapprochement");

-- CreateIndex
CREATE INDEX "Client_lotId_idx" ON "Client"("lotId");

-- CreateIndex
CREATE INDEX "Client_statutBascule_idx" ON "Client"("statutBascule");

-- CreateIndex
CREATE INDEX "Utilisateur_clientId_idx" ON "Utilisateur"("clientId");

-- CreateIndex
CREATE INDEX "Numero_clientId_idx" ON "Numero"("clientId");

-- CreateIndex
CREATE INDEX "Numero_utilisateurId_idx" ON "Numero"("utilisateurId");

-- CreateIndex
CREATE INDEX "Numero_numeroNormalise_idx" ON "Numero"("numeroNormalise");

-- CreateIndex
CREATE UNIQUE INDEX "ModeleEquipement_libelle_key" ON "ModeleEquipement"("libelle");

-- CreateIndex
CREATE INDEX "ModeleEquipement_marque_idx" ON "ModeleEquipement"("marque");

-- CreateIndex
CREATE INDEX "Equipement_clientId_idx" ON "Equipement"("clientId");

-- CreateIndex
CREATE INDEX "Equipement_utilisateurId_idx" ON "Equipement"("utilisateurId");

-- CreateIndex
CREATE INDEX "Equipement_macNormalise_idx" ON "Equipement"("macNormalise");

-- CreateIndex
CREATE UNIQUE INDEX "EtapeModele_libelle_key" ON "EtapeModele"("libelle");

-- CreateIndex
CREATE INDEX "SuiviEtape_statut_idx" ON "SuiviEtape"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "SuiviEtape_utilisateurId_etapeId_key" ON "SuiviEtape"("utilisateurId", "etapeId");

-- CreateIndex
CREATE INDEX "ListeValeur_categorie_ordre_idx" ON "ListeValeur"("categorie", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "ListeValeur_categorie_valeur_key" ON "ListeValeur"("categorie", "valeur");

-- CreateIndex
CREATE INDEX "ImportRun_type_creeLe_idx" ON "ImportRun"("type", "creeLe");

-- CreateIndex
CREATE INDEX "ExportBatch_type_creeLe_idx" ON "ExportBatch"("type", "creeLe");

-- CreateIndex
CREATE INDEX "AuditLog_entite_entiteId_idx" ON "AuditLog"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "AuditLog_creeLe_idx" ON "AuditLog"("creeLe");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Numero" ADD CONSTRAINT "Numero_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Numero" ADD CONSTRAINT "Numero_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipement" ADD CONSTRAINT "Equipement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipement" ADD CONSTRAINT "Equipement_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipement" ADD CONSTRAINT "Equipement_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ModeleEquipement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviEtape" ADD CONSTRAINT "SuiviEtape_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviEtape" ADD CONSTRAINT "SuiviEtape_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeModele"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "UtilisateurApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "UtilisateurApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "UtilisateurApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

