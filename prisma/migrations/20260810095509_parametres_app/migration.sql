-- CreateTable
CREATE TABLE "ParametreApp" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametreApp_pkey" PRIMARY KEY ("cle")
);

-- Copie systématique par défaut (modifiable dans Paramètres).
INSERT INTO "ParametreApp" ("cle", "valeur", "majLe")
VALUES ('copieMail', 'migration.ext@everlink-services.fr', now())
ON CONFLICT ("cle") DO NOTHING;
