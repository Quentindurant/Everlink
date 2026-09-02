-- Avancement du colis sur la frise à quatre points (1 Expédié … 4 Livré). Nullable :
-- un colis jamais interrogé n'a pas d'étape, et la frise le montre tel quel.
ALTER TABLE "ArticleStock" ADD COLUMN IF NOT EXISTS "suiviEtape" INTEGER;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "colisSuiviEtape" INTEGER;

-- Envoi groupé des ONT récupérés chez les clients vers le grossiste. Les champs de suivi
-- portent les mêmes noms que ceux d'ArticleStock : le cron de tracking traite les deux
-- tables avec le même code, sans cas particulier.
CREATE TABLE IF NOT EXISTS "LotRetourOnt" (
  "id"           TEXT PRIMARY KEY,
  "destinataire" TEXT NOT NULL,
  "transporteur" TEXT,
  "numeroSuivi"  TEXT,
  "expedieLe"    TIMESTAMP(3),
  "suiviStatut"  TEXT,
  "suiviLibelle" TEXT,
  "suiviEtape"   INTEGER,
  "suiviLivreLe" TIMESTAMP(3),
  "suiviMajLe"   TIMESTAMP(3),
  "creeLe"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LotRetourOnt_numeroSuivi_idx" ON "LotRetourOnt" ("numeroSuivi");
CREATE INDEX IF NOT EXISTS "LotRetourOnt_expedieLe_idx" ON "LotRetourOnt" ("expedieLe");

-- Rattachement de l'ONT à son lot de retour. ON DELETE SET NULL : supprimer un lot ne doit
-- jamais faire disparaître la trace des appareils qu'il contenait.
ALTER TABLE "ArticleStock" ADD COLUMN IF NOT EXISTS "lotRetourId" TEXT;
CREATE INDEX IF NOT EXISTS "ArticleStock_lotRetourId_idx" ON "ArticleStock" ("lotRetourId");

DO $$
BEGIN
  ALTER TABLE "ArticleStock"
    ADD CONSTRAINT "ArticleStock_lotRetourId_fkey"
    FOREIGN KEY ("lotRetourId") REFERENCES "LotRetourOnt"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
