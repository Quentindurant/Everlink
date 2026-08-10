-- AlterTable
ALTER TABLE "MailEnvoi" ADD COLUMN     "mailjetCustomId" TEXT,
ADD COLUMN     "suiviMajLe" TIMESTAMP(3),
ADD COLUMN     "suiviStatut" TEXT;
