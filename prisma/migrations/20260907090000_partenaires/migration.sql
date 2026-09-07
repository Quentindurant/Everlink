-- Deuxième partenaire (INOVACOM) à côté d'EVERLINK. Le tableau de suivi porte déjà une
-- colonne « partenaire » : son contenu sert de code, pour que la synchronisation range
-- chaque ligne du bon côté sans table de correspondance.
--
-- Ce qui appartient à un partenaire : les clients, le stock, les lots de retour et les
-- modèles de mail. Les techniciens et les prestataires restent communs — c'est le réseau
-- de GC, pas celui d'un partenaire.

CREATE TABLE IF NOT EXISTS "Partenaire" (
  "id"            TEXT PRIMARY KEY,
  "code"          TEXT NOT NULL UNIQUE,
  "nom"           TEXT NOT NULL,
  "logo"          TEXT NOT NULL,
  "site"          TEXT,
  "mailMigration" TEXT,
  "actif"         BOOLEAN NOT NULL DEFAULT true,
  "ordre"         INTEGER NOT NULL DEFAULT 0,
  "creeLe"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Partenaire" ("id","code","nom","logo","site","mailMigration","ordre","creeLe","majLe")
SELECT 'part_everlink','EVERLINK','EverLink','/everlink-logo.png',
       'https://www.everlink-services.fr/','migration.ext@everlink-services.fr',0,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Partenaire" WHERE "code" = 'EVERLINK');

-- Logo, site et boîte mail d'INOVACOM restent à renseigner : on ne devine pas une adresse à
-- laquelle des clients répondront, et afficher le logo d'EverLink sous un autre nom serait
-- pire que le nom écrit en toutes lettres. Logo vide = nom affiché en texte.
INSERT INTO "Partenaire" ("id","code","nom","logo","site","mailMigration","ordre","creeLe","majLe")
SELECT 'part_inovacom','INOVACOM','Inovacom','',NULL,NULL,1,now(),now()
WHERE NOT EXISTS (SELECT 1 FROM "Partenaire" WHERE "code" = 'INOVACOM');

-- Rattachement. Tout l'existant est EVERLINK : c'était le seul partenaire jusqu'ici.
ALTER TABLE "Client"       ADD COLUMN IF NOT EXISTS "partenaireId" TEXT;
ALTER TABLE "ArticleStock" ADD COLUMN IF NOT EXISTS "partenaireId" TEXT;
ALTER TABLE "LotRetourOnt" ADD COLUMN IF NOT EXISTS "partenaireId" TEXT;
ALTER TABLE "ModeleMail"   ADD COLUMN IF NOT EXISTS "partenaireId" TEXT;

UPDATE "Client"       SET "partenaireId" = 'part_everlink' WHERE "partenaireId" IS NULL;
UPDATE "ArticleStock" SET "partenaireId" = 'part_everlink' WHERE "partenaireId" IS NULL;
UPDATE "LotRetourOnt" SET "partenaireId" = 'part_everlink' WHERE "partenaireId" IS NULL;
UPDATE "ModeleMail"   SET "partenaireId" = 'part_everlink' WHERE "partenaireId" IS NULL;

CREATE INDEX IF NOT EXISTS "Client_partenaireId_idx"       ON "Client" ("partenaireId");
CREATE INDEX IF NOT EXISTS "ArticleStock_partenaireId_idx" ON "ArticleStock" ("partenaireId");
CREATE INDEX IF NOT EXISTS "LotRetourOnt_partenaireId_idx" ON "LotRetourOnt" ("partenaireId");
CREATE INDEX IF NOT EXISTS "ModeleMail_partenaireId_idx"   ON "ModeleMail" ("partenaireId");

-- ON DELETE RESTRICT : supprimer un partenaire qui porte encore des dossiers doit échouer,
-- pas les détacher silencieusement.
DO $$
BEGIN
  ALTER TABLE "Client" ADD CONSTRAINT "Client_partenaireId_fkey"
    FOREIGN KEY ("partenaireId") REFERENCES "Partenaire"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "ArticleStock" ADD CONSTRAINT "ArticleStock_partenaireId_fkey"
    FOREIGN KEY ("partenaireId") REFERENCES "Partenaire"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "LotRetourOnt" ADD CONSTRAINT "LotRetourOnt_partenaireId_fkey"
    FOREIGN KEY ("partenaireId") REFERENCES "Partenaire"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "ModeleMail" ADD CONSTRAINT "ModeleMail_partenaireId_fkey"
    FOREIGN KEY ("partenaireId") REFERENCES "Partenaire"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
