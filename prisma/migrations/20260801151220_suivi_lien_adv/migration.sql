-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lienCommande" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lienCommandeLe" TIMESTAMP(3),
ADD COLUMN     "lienCommandePar" TEXT,
ADD COLUMN     "lienLivraisonPrevue" TIMESTAMP(3),
ADD COLUMN     "lienLivre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lienLivreLe" TIMESTAMP(3),
ADD COLUMN     "lienOperateur" TEXT,
ADD COLUMN     "lienReference" TEXT;
