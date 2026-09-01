-- Deux étapes de fin de migration côté Sewan, après la bascule des postes : les numéros
-- rejoignent le trunk Sewan du bureau Everlink, puis le site du client est supprimé.
-- Idempotent : ne recrée pas une étape déjà présente, ne touche pas aux libellés modifiés.

INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe")
SELECT
  'ep_migration_trunk_sewan',
  'Migrer les numéros vers le trunk Sewan',
  'Clôture Sewan',
  'Les numéros quittent le site du client pour le trunk Sewan du bureau Everlink.',
  120,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "EtapeProjet" WHERE "libelle" = 'Migrer les numéros vers le trunk Sewan'
);

INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe")
SELECT
  'ep_suppression_site_sewan',
  'Supprimer le site sur Sewan',
  'Clôture Sewan',
  'Dernière étape : le site n''est supprimé qu''une fois les numéros déplacés sur le trunk.',
  130,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "EtapeProjet" WHERE "libelle" = 'Supprimer le site sur Sewan'
);
