-- Mails clients par partenaire. Jusqu'ici la copie, la signature et le numéro de l'équipe
-- migration étaient globaux, donc EverLink pour tout le monde : un client INOVACOM aurait
-- reçu un mail signé EverLink. Ces réglages passent sur le partenaire.
--
-- Migration additive : ADD COLUMN, UPDATE limité aux valeurs encore vides, INSERT
-- conditionnel. Rejouable sans rien écraser de ce qui aurait été saisi dans Paramètres.

ALTER TABLE "Partenaire" ADD COLUMN IF NOT EXISTS "copieMail"       TEXT;
ALTER TABLE "Partenaire" ADD COLUMN IF NOT EXISTS "expediteur"      TEXT;
ALTER TABLE "Partenaire" ADD COLUMN IF NOT EXISTS "telephone"       TEXT;
ALTER TABLE "Partenaire" ADD COLUMN IF NOT EXISTS "signatureLignes" TEXT;

-- EVERLINK reprend l'adresse en copie globale : rien ne change pour ses envois. L'expéditeur
-- et le téléphone restent vides, ce qui conserve SMTP_FROM et NUMERO_GC.
UPDATE "Partenaire"
SET "copieMail" = (SELECT "valeur" FROM "ParametreApp" WHERE "cle" = 'copieMail'), "majLe" = now()
WHERE "code" = 'EVERLINK' AND "copieMail" IS NULL
  AND EXISTS (SELECT 1 FROM "ParametreApp" WHERE "cle" = 'copieMail');

-- INOVACOM : coordonnées fournies par l'ADV (signature et consignes de copie du 02/11/2026).
-- L'expéditeur est validé dans Mailjet depuis le 02/11/2026 ; une adresse non validée y
-- ferait bloquer le message après coup, sans erreur à l'envoi.
UPDATE "Partenaire" SET
  "mailMigration"   = COALESCE("mailMigration", 'migration.ext.ino@inovacom.fr'),
  "expediteur"      = COALESCE("expediteur", 'migration.ext.ino@inovacom.fr'),
  "site"            = COALESCE("site", 'https://www.inovacom.fr/'),
  "telephone"       = COALESCE("telephone", '01.86.70.98.51'),
  "copieMail"       = COALESCE("copieMail", 'commercial@inovacom.fr, npereira@inovacom.fr'),
  "signatureLignes" = COALESCE("signatureLignes", E'INOVACOM\n5 rue de la corderie - Batiment G5B\n94150 Rungis MIN'),
  "majLe"           = now()
WHERE "code" = 'INOVACOM';

-- Premier modèle INOVACOM : prévenance d'une migration à distance, texte fourni par l'ADV.
-- Le nom du client, la boîte migration et le téléphone passent par les variables pour que
-- Paramètres reste la seule source de ces valeurs.
INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe", "partenaireId")
SELECT
  'mm_inovacom_distance_prevenance',
  'Centrex - à distance',
  'PREVENANCE',
  '[INOVACOM - IMPORTANT] - Évolution de votre service de téléphonie',
  $corps$Bonjour {civilite_nom},

Afin de continuer à vous offrir la meilleure qualité de service possible, INOVACOM fait évoluer son infrastructure de téléphonie. Cette évolution vous permettra de bénéficier de services plus performants et plus fiables au quotidien.

Dans le cadre de cette évolution, une migration de votre service de téléphonie doit être réalisée.

Ce qui ne change pas pour vous :
- Aucun changement tarifaire.
- Aucune modification de la durée d'engagement de vos contrats.
- Vos numéros de téléphone restent identiques.
- Vous conservez vos postes téléphoniques actuels.
- Aucuns travaux ne sont à prévoir.

Comment se déroulera la migration :
- Dans les prochains jours, notre équipe migration vous contactera afin de convenir d'une date et de confirmer le contact technique présent sur site le jour de l'opération.
- Intervention à distance de notre équipe technique pour reconfigurer vos postes téléphoniques. Un redémarrage des postes téléphoniques sera réalisé avec votre contact sur site.

Vos prestataires tiers :
Si certains de vos équipements (logiciel métier, alarme, vidéosurveillance, contrôle d'accès, pare-feu, etc.) sont gérés par des prestataires externes, merci de préparer leurs coordonnées. Nous recueillerons ces informations lors de notre appel de planification afin d'anticiper les éventuelles actions nécessaires et d'assurer la continuité de vos services.

Pour toute question, vous pouvez contacter notre équipe à l'adresse {mail_migration} ou au {numero_gc}.

Nous vous remercions pour votre confiance.

Cordialement,

L'Equipe migration INOVACOM$corps$,
  true,
  0,
  now(),
  now(),
  'part_inovacom'
WHERE EXISTS (SELECT 1 FROM "Partenaire" WHERE "id" = 'part_inovacom')
  AND NOT EXISTS (SELECT 1 FROM "ModeleMail" WHERE "id" = 'mm_inovacom_distance_prevenance');
