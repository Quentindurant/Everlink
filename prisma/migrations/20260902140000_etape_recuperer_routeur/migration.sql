-- Le routeur Sewan est repris chez le client en même temps que l'ONT. Le chef de projet
-- relève son numéro de série sur place, ce que le staging saisissait jusqu'ici à la main
-- depuis l'onglet Réception, à distance et sans l'appareil sous les yeux.
-- Idempotent : ne recrée pas une étape déjà présente, ne touche pas aux libellés modifiés.

INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe")
SELECT
  'ep_recuperer_routeur',
  'Récupérer le routeur du client',
  'Client',
  'Relever le numéro de série sous le routeur et choisir son modèle. S''il n''y a rien à reprendre, indiquer pourquoi.',
  116,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "EtapeProjet" WHERE "libelle" = 'Récupérer le routeur du client'
);
