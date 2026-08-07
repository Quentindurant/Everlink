-- CreateTable
CREATE TABLE "ConfigRouteur" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientTexte" TEXT,
    "nomFichier" TEXT NOT NULL,
    "donnees" JSONB NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigRouteur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfigRouteur_clientId_idx" ON "ConfigRouteur"("clientId");

-- AddForeignKey
ALTER TABLE "ConfigRouteur" ADD CONSTRAINT "ConfigRouteur_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
