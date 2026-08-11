-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "codeMonday" TEXT,
    "adresse" TEXT,
    "departement" TEXT,
    "dateIntervention" TIMESTAMP(3),
    "creneauIntervention" TEXT,
    "scenario" TEXT,
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
    "mondayRaw" JSONB,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_codeMonday_key" ON "Site"("codeMonday");

-- CreateIndex
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
