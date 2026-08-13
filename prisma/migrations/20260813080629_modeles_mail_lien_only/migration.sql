-- Modèles de mail pour le scénario « Lien only » : remplacement du lien internet seul,
-- aucune téléphonie. Calqués sur les modèles Centrex + FTTH, sans les volets téléphones.
-- Idempotent : ne recrée pas un modèle déjà présent, ne touche pas aux textes retouchés
-- ensuite par les ADV dans Paramètres.

INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe")
SELECT
  'mm_lienonly_prev',
  'Lien only',
  'PREVENANCE',
  '[EVERLINK] - Évolution de votre accès internet',
  E'Bonjour {civilite_nom},\n\nDans le cadre de l''amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l''infrastructure technique qui assure votre accès internet (fibre).\n\nCette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance. Il s''agit d''une opération simple et rapide, qui n''aura pas d''impact sur votre activité.\n\nCe que cela implique pour vous :\n- Aucun changement de votre service de téléphonie : cette opération ne concerne que votre accès internet\n- Aucuns travaux : seul votre routeur sera remplacé\n- Une intervention sur votre site sera nécessaire. Celle-ci sera planifiée avec vous en amont afin d''installer un nouveau routeur et de procéder à la bascule de votre accès Internet.\n\nVos prestataires tiers : si certains de vos équipements sont connectés à votre accès Internet et gérés par des prestataires externes (alarme, vidéosurveillance, contrôle d''accès, pare-feu, etc.), nous vous remercions de préparer la liste de ces prestataires ainsi que leurs coordonnées. Ces informations seront recueillies lors de notre prochain appel de planification.\n\nNotre équipe vous contactera très prochainement afin de convenir d''une date d''intervention.\nPour toute question : migration.ext@everlink-services.fr\n\nNous vous remercions pour votre confiance et restons à votre disposition.\nCordialement,\n\nPôle migration — Everlink Services\nmigration.ext@everlink-services.fr | www.everlink-services.fr',
  true,
  (SELECT COALESCE(MAX("ordre"), 0) + 1 FROM "ModeleMail"),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "ModeleMail" WHERE "scenario" = 'Lien only' AND "type" = 'PREVENANCE'
);

INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe")
SELECT
  'mm_lienonly_conf',
  'Lien only',
  'CONFIRMATION',
  '[EVERLINK] - Confirmation de votre rendez-vous — Migration de votre accès internet {nom_client}',
  E'Bonjour {civilite_nom},\n\nComme convenu lors de notre échange, nous vous confirmons la planification de l''intervention nécessaire à la migration de votre accès internet. Il s''agit d''une opération simple : un seul rendez-vous, réunissant l''intervention de l''opérateur et celle du technicien.\n\nRendez-vous avec l''opérateur et le technicien — livraison du lien et bascule de votre accès Internet (durée 2h)\nDate : {date}  |  Créneau : {creneau}\nLieu d''intervention : {adresse}\n\nPrérequis à préparer avant l''intervention :\n- Accès libre au local technique / à la baie où est installé votre routeur actuel\n- Accès libre au local technique où arrive la fibre (point de livraison FTTH)\n- Présence d''une personne habilitée sur site pendant toute la durée du rendez-vous\n\nVotre téléphonie n''est pas concernée par cette intervention.\n\nCe rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d''intervention, à migration.ext@everlink-services.fr ou au {numero_gc}.\n\nCordialement,\n\nPôle migration — Everlink Services',
  true,
  (SELECT COALESCE(MAX("ordre"), 0) + 1 FROM "ModeleMail"),
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "ModeleMail" WHERE "scenario" = 'Lien only' AND "type" = 'CONFIRMATION'
);
