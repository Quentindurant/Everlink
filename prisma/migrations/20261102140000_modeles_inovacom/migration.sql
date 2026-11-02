-- Modèles de mail INOVACOM fournis par l'ADV le 02/11/2026 (doc des templates, §11.2 et
-- §11.3) : prévenance et confirmation sur site, confirmation à distance, et l'objet
-- définitif de la prévenance à distance créée par la migration précédente.
--
-- Les crochets du doc deviennent les variables de l'app ; [Nom de la filiale] est écrit
-- INOVACOM en toutes lettres, comme dans le premier modèle. INSERT conditionnels sur l'id :
-- rejouer la migration ne recrée rien et n'écrase pas un texte retouché dans Paramètres.

-- Objet de la prévenance à distance : remplacé seulement s'il n'a pas été retouché depuis.
UPDATE "ModeleMail"
SET "objet" = 'INOVACOM – INFORMATION IMPORTANTE : Migration de votre service téléphonie',
    "ordre" = 2,
    "majLe" = now()
WHERE "id" = 'mm_inovacom_distance_prevenance'
  AND "objet" = '[INOVACOM - IMPORTANT] - Évolution de votre service de téléphonie';

INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe", "partenaireId")
SELECT
  'mm_inovacom_site_prevenance',
  'Centrex - sur site',
  'PREVENANCE',
  'INOVACOM – INFORMATION IMPORTANTE : Migration de votre service téléphonie',
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
- Dans les prochains jours, notre équipe migration vous contactera afin de convenir avec vous d'une date d'intervention.
- Intervention de notre technicien pour la réalisation de la migration de votre service de téléphonie.

Vos prestataires tiers :
Si certains de vos équipements (logiciel métier, alarme, vidéosurveillance, contrôle d'accès, pare-feu, etc.) sont gérés par des prestataires externes, merci de préparer leurs coordonnées. Nous recueillerons ces informations lors de notre appel de planification afin d'anticiper les éventuelles actions nécessaires et d'assurer la continuité de vos services.

Pour toute question, vous pouvez contacter notre équipe à l'adresse {mail_migration} ou au {numero_gc}.

Nous vous remercions pour votre confiance.

Cordialement,

L'Equipe migration INOVACOM$corps$,
  true, 0, now(), now(), 'part_inovacom'
WHERE EXISTS (SELECT 1 FROM "Partenaire" WHERE "id" = 'part_inovacom')
  AND NOT EXISTS (SELECT 1 FROM "ModeleMail" WHERE "id" = 'mm_inovacom_site_prevenance');

INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe", "partenaireId")
SELECT
  'mm_inovacom_site_confirmation',
  'Centrex - sur site',
  'CONFIRMATION',
  'INOVACOM – INFORMATION IMPORTANTE : Confirmation de votre rendez-vous – Migration de votre service de téléphonie',
  $corps$Bonjour {civilite_nom},

Comme convenu, nous vous confirmons le rendez-vous prévu pour la migration de votre service de téléphonie.

Votre rendez-vous
- Date : {date}  |  Créneau : {creneau}
- Lieu d'intervention : {adresse}
- Contact sur site : {contact_site}
- Durée d’intervention : Environ 4 heures

À prévoir le jour de l’intervention :
- Accès aux locaux techniques où se trouvent vos équipements téléphoniques.
- Présence d'une personne habilitée sur site pendant l'intervention.

Si vous utilisez DOKO (softphone) sur votre ordinateur et/ou votre mobile :
- Installez dès maintenant le nouveau softphone Speek : https://speekapp.io/telechargement/ (ou directement depuis le store de votre mobile).
- Si des droits administrateurs sont nécessaires, merci de vous rapprocher de votre support informatique en amont.
- Le jour de l'intervention, nous recommandons la présence des utilisateurs concernés afin de faciliter la mise en service. Si nécessaire, un accompagnement à distance pourra être organisé. Merci de nous communiquer leurs coordonnées (nom et téléphone/email) à l'avance.

Une courte interruption de service pourra être constatée lors de la bascule. Nos équipes mettront tout en œuvre pour en limiter la durée.

Pour toute demande de report, merci de nous prévenir au moins 72 heures avant l'intervention à l'adresse {mail_migration} ou au {numero_gc}.

Nous vous remercions pour votre confiance.

Cordialement,

L'Equipe migration INOVACOM$corps$,
  true, 1, now(), now(), 'part_inovacom'
WHERE EXISTS (SELECT 1 FROM "Partenaire" WHERE "id" = 'part_inovacom')
  AND NOT EXISTS (SELECT 1 FROM "ModeleMail" WHERE "id" = 'mm_inovacom_site_confirmation');

INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe", "partenaireId")
SELECT
  'mm_inovacom_distance_confirmation',
  'Centrex - à distance',
  'CONFIRMATION',
  'INOVACOM – INFORMATION IMPORTANTE : Confirmation de votre rendez-vous – Migration à distance de votre service de téléphonie',
  $corps$Bonjour {civilite_nom},

Comme convenu, nous vous confirmons le rendez-vous prévu pour la migration de votre service de téléphonie.

Votre rendez-vous technique à distance
- Date : {date}  |  Créneau : {creneau}
- Contact sur site : {contact_site}
- Durée d’intervention : Environ 2 heures

À prévoir le jour de l’intervention :
- Présence sur site, durant le créneau indiqué, d'une personne pouvant manipuler les postes téléphoniques (redémarrage, vérification des branchements).

Une courte interruption de service pourra être constatée lors de la bascule. Nos équipes mettront tout en œuvre pour en limiter la durée.

Pour toute demande de report, merci de nous prévenir au moins 72 heures avant l'intervention à l'adresse {mail_migration} ou au {numero_gc}.

Nous vous remercions pour votre confiance.

Cordialement,

L'Equipe migration INOVACOM$corps$,
  true, 3, now(), now(), 'part_inovacom'
WHERE EXISTS (SELECT 1 FROM "Partenaire" WHERE "id" = 'part_inovacom')
  AND NOT EXISTS (SELECT 1 FROM "ModeleMail" WHERE "id" = 'mm_inovacom_distance_confirmation');
