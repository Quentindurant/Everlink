-- Modèles listés à part sur l'export MAC : pieuvres de conférence et postes qui se
-- déclarent différemment côté UNYC (T42U…). Cochable dans Paramètres → Modèles.
ALTER TABLE "ModeleEquipement" ADD COLUMN "exportSepare" BOOLEAN NOT NULL DEFAULT false;

-- Modèles déjà présents au catalogue : pré-cochés (modifiable ensuite dans Paramètres).
UPDATE "ModeleEquipement" SET "exportSepare" = true
WHERE "libelle" IN ('Polycom IP5000', 'Polycom RealPresence Trio 8300', 'Yealink T42U');
