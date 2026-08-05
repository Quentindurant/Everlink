-- AlterTable
ALTER TABLE "ArticleStock" ADD COLUMN     "numeroSuivi" TEXT,
ADD COLUMN     "suiviLibelle" TEXT,
ADD COLUMN     "suiviLivreLe" TIMESTAMP(3),
ADD COLUMN     "suiviMajLe" TIMESTAMP(3),
ADD COLUMN     "suiviStatut" TEXT,
ADD COLUMN     "transporteur" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "colisNumeroSuivi" TEXT,
ADD COLUMN     "colisSuiviLibelle" TEXT,
ADD COLUMN     "colisSuiviLivreLe" TIMESTAMP(3),
ADD COLUMN     "colisSuiviMajLe" TIMESTAMP(3),
ADD COLUMN     "colisSuiviStatut" TEXT,
ADD COLUMN     "colisTransporteur" TEXT;

-- CreateIndex
CREATE INDEX "ArticleStock_numeroSuivi_idx" ON "ArticleStock"("numeroSuivi");
