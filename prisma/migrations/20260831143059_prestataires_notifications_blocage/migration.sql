-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "chefProjetNom" TEXT,
ADD COLUMN     "telephoneBloque" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telephoneBloqueLe" TIMESTAMP(3),
ADD COLUMN     "telephoneBloqueMotif" TEXT,
ADD COLUMN     "telephoneBloquePar" TEXT;

-- CreateTable
CREATE TABLE "PrestataireClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "metier" TEXT NOT NULL,
    "societe" TEXT NOT NULL,
    "contactNom" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "commentaire" TEXT,
    "statutContact" TEXT NOT NULL DEFAULT 'A_CONTACTER',
    "contacteLe" TIMESTAMP(3),
    "contactePar" TEXT,
    "noteContact" TEXT,
    "creePar" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrestataireClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "destinataireEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lien" TEXT,
    "clientId" TEXT,
    "luLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefProjet" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefProjet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrestataireClient_clientId_idx" ON "PrestataireClient"("clientId");

-- CreateIndex
CREATE INDEX "PrestataireClient_statutContact_idx" ON "PrestataireClient"("statutContact");

-- CreateIndex
CREATE INDEX "Notification_destinataireEmail_luLe_idx" ON "Notification"("destinataireEmail", "luLe");

-- CreateIndex
CREATE INDEX "Notification_clientId_type_idx" ON "Notification"("clientId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ChefProjet_nom_key" ON "ChefProjet"("nom");

-- AddForeignKey
ALTER TABLE "PrestataireClient" ADD CONSTRAINT "PrestataireClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
