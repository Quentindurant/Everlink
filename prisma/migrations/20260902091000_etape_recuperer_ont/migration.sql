-- L'ONT du client est repris le jour de l'installation, pendant que le technicien est encore
-- sur place. L'étape réclame le numéro de série, ou la raison de son absence quand il n'y a
-- rien à reprendre.
-- Idempotent : ne recrée pas une étape déjà présente, ne touche pas aux libellés modifiés.

INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe")
SELECT
  'ep_recuperer_ont',
  'Récupérer l''ONT du client',
  'Client',
  'Relever le numéro de série sur l''étiquette de l''ONT. S''il n''y en a pas sur place, indiquer pourquoi : l''appareil est attendu au staging pour repartir au grossiste.',
  115,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "EtapeProjet" WHERE "libelle" = 'Récupérer l''ONT du client'
);
