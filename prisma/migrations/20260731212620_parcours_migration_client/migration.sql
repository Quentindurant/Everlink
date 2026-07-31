-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "dernierContactLe" TIMESTAMP(3),
ADD COLUMN     "etapeMigrationId" TEXT,
ADD COLUMN     "nbTentativesContact" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referenceClient" TEXT;

-- CreateTable
CREATE TABLE "EtapeMigration" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#667085',
    "estBloquant" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapeMigration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtapeMigration_libelle_key" ON "EtapeMigration"("libelle");

-- CreateIndex
CREATE INDEX "EtapeMigration_ordre_idx" ON "EtapeMigration"("ordre");

-- CreateIndex
CREATE INDEX "Client_etapeMigrationId_idx" ON "Client"("etapeMigrationId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_etapeMigrationId_fkey" FOREIGN KEY ("etapeMigrationId") REFERENCES "EtapeMigration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
