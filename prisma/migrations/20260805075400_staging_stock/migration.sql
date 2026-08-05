-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "routeurClientReutilise" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ArticleStock" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "dateReception" TIMESTAMP(3),
    "etatAppareil" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_STOCK',
    "origine" TEXT NOT NULL DEFAULT 'EVERLINK',
    "clientId" TEXT,
    "clientFinalTexte" TEXT,
    "dateEnvoi" TIMESTAMP(3),
    "dateInstallation" TIMESTAMP(3),
    "commentaire" TEXT,
    "archiveA" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleStock_type_idx" ON "ArticleStock"("type");

-- CreateIndex
CREATE INDEX "ArticleStock_statut_idx" ON "ArticleStock"("statut");

-- CreateIndex
CREATE INDEX "ArticleStock_clientId_idx" ON "ArticleStock"("clientId");

-- CreateIndex
CREATE INDEX "ArticleStock_numeroSerie_idx" ON "ArticleStock"("numeroSerie");

-- AddForeignKey
ALTER TABLE "ArticleStock" ADD CONSTRAINT "ArticleStock_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
