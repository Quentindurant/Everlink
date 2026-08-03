-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "technicienId" TEXT;

-- CreateTable
CREATE TABLE "Prestataire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prestataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technicien" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prestataireId" TEXT,
    "departements" TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technicien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prestataire_nom_key" ON "Prestataire"("nom");

-- CreateIndex
CREATE INDEX "Technicien_prestataireId_idx" ON "Technicien"("prestataireId");

-- CreateIndex
CREATE INDEX "Client_technicienId_idx" ON "Client"("technicienId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_technicienId_fkey" FOREIGN KEY ("technicienId") REFERENCES "Technicien"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technicien" ADD CONSTRAINT "Technicien_prestataireId_fkey" FOREIGN KEY ("prestataireId") REFERENCES "Prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
