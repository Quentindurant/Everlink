-- CreateEnum
CREATE TYPE "DeclencheurSync" AS ENUM ('MANUEL', 'CRON', 'CLI');

-- CreateTable
CREATE TABLE "SheetSyncRun" (
    "id" TEXT NOT NULL,
    "declencheur" "DeclencheurSync" NOT NULL,
    "ongletsEcrits" JSONB NOT NULL,
    "erreurs" JSONB,
    "succes" BOOLEAN NOT NULL DEFAULT true,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetSyncRun_creeLe_idx" ON "SheetSyncRun"("creeLe");

-- AddForeignKey
ALTER TABLE "SheetSyncRun" ADD CONSTRAINT "SheetSyncRun_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "UtilisateurApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

