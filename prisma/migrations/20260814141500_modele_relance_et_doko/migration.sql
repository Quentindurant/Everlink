-- Modèle de relance (prévenance restée sans réponse) et marquage des softphones.
-- Migration séparée de l'ajout des valeurs d'enum : PostgreSQL interdit d'utiliser une
-- valeur d'enum dans la transaction qui la crée.

-- Les softphones (DOKO chez Sewan, Speek chez UNYC) se reconnaissent par leur type, pas
-- par une liste de libellés en dur.
UPDATE "ModeleEquipement" SET "type" = 'SOFTPHONE' WHERE "libelle" IN ('DOKO', 'Speek');

-- Modèle de relance, unique et valable pour tous les scénarios.
INSERT INTO "ModeleMail" ("id", "scenario", "type", "objet", "corps", "actif", "ordre", "creeLe", "majLe")
SELECT
  'mm_relance_tous',
  'Tous scénarios',
  'RELANCE',
  '[EVERLINK] - Relance — Migration de vos services {nom_client}',
  E'Bonjour {civilite_nom},\n\nNous revenons vers vous concernant notre précédent message relatif à la migration de vos services.\n\nSauf erreur de notre part, nous sommes toujours dans l''attente de votre retour afin d''assurer le suivi de votre dossier et d''engager les prochaines étapes de la migration.\n\nNous vous remercions de bien vouloir nous confirmer la bonne réception de notre précédent message et de nous indiquer vos disponibilités pour convenir d''une date d''intervention.\n\nSi ce message ne vous concerne pas ou si un autre interlocuteur suit ce dossier, nous vous serions reconnaissants de nous communiquer ses coordonnées.\n\nPour toute question : migration.ext@everlink-services.fr ou {numero_gc}\n\nNous restons à votre disposition et vous remercions pour votre confiance.\nCordialement,\n\nPôle migration — Everlink Services\nmigration.ext@everlink-services.fr | www.everlink-services.fr',
  true,
  (SELECT COALESCE(MAX("ordre"), 0) + 1 FROM "ModeleMail"),
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM "ModeleMail" WHERE "type" = 'RELANCE');
