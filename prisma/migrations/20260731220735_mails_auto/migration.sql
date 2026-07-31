-- CreateEnum
CREATE TYPE "TypeMail" AS ENUM ('PREVENANCE', 'CONFIRMATION');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "creneauIntervention" TEXT;

-- CreateTable
CREATE TABLE "ModeleMail" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "type" "TypeMail" NOT NULL,
    "objet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeleMail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailEnvoi" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "TypeMail" NOT NULL,
    "destinataire" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "succes" BOOLEAN NOT NULL DEFAULT true,
    "erreur" TEXT,
    "auteurId" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailEnvoi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeleMail_type_idx" ON "ModeleMail"("type");

-- CreateIndex
CREATE INDEX "MailEnvoi_clientId_creeLe_idx" ON "MailEnvoi"("clientId", "creeLe");

-- AddForeignKey
ALTER TABLE "MailEnvoi" ADD CONSTRAINT "MailEnvoi_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailEnvoi" ADD CONSTRAINT "MailEnvoi_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "UtilisateurApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
