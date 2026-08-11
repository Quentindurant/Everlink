-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "telephoneAttribueA" TEXT,
ADD COLUMN     "telephoneAttribueLe" TIMESTAMP(3);

-- Statut d'étape « Aucun » : l'étape ne s'applique pas à ce poste, la jauge le compte
-- comme résolu (au même titre que « Fait »).
INSERT INTO "ListeValeur" ("id", "categorie", "valeur", "ordre", "actif", "creeLe", "majLe")
VALUES ('lv-statut-etape-aucun', 'STATUT_ETAPE', 'Aucun', 3, true, now(), now())
ON CONFLICT ("categorie", "valeur") DO NOTHING;
