-- Logo INOVACOM fourni. Ne remplace pas un chemin déjà renseigné : si quelqu'un l'a corrigé
-- depuis, sa valeur fait foi.
UPDATE "Partenaire"
SET "logo" = '/inovacom-logo.png', "majLe" = now()
WHERE "code" = 'INOVACOM' AND ("logo" IS NULL OR "logo" = '');
