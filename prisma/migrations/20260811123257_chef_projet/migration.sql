-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "projetAttribueA" TEXT,
ADD COLUMN     "projetAttribueLe" TIMESTAMP(3),
ADD COLUMN     "projetClosLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EtapeProjet" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "aide" TEXT,
    "ordre" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapeProjet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviProjet" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "etapeId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'À faire',
    "commentaire" TEXT,
    "faitLe" TIMESTAMP(3),
    "faitPar" TEXT,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuiviProjet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtapeProjet_libelle_key" ON "EtapeProjet"("libelle");

-- CreateIndex
CREATE INDEX "SuiviProjet_statut_idx" ON "SuiviProjet"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "SuiviProjet_clientId_etapeId_key" ON "SuiviProjet"("clientId", "etapeId");

-- AddForeignKey
ALTER TABLE "SuiviProjet" ADD CONSTRAINT "SuiviProjet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviProjet" ADD CONSTRAINT "SuiviProjet_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeProjet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checklist de préparation par défaut (idempotente : ne réécrit pas un libellé existant).
INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe") VALUES
  ('epj_ident',    'Récupérer les identifiants Sewan',            'Avant reset',            'Compte adminyea + mot de passe, à récupérer sur Sewan avant toute intervention.', 10, true, now(), now()),
  ('epj_monter',   'Monter sur les téléphones',                   'Avant reset',            'Se connecter à l''interface web de chaque poste TANT QUE le téléphone n''est pas resetté.', 20, true, now(), now()),
  ('epj_annuaire', 'Récupérer l''annuaire local des téléphones',  'Avant reset',            'L''annuaire local est perdu au reset : l''exporter poste par poste avant.', 30, true, now(), now()),
  ('epj_blf',      'Vérifier les BLF poste par poste vs UNYC',    'Avant reset',            'Comparer les touches BLF réelles du téléphone avec celles configurées côté UNYC.', 40, true, now(), now()),
  ('epj_ip',       'Vérifier IP statique ou DHCP',                'Avant reset',            'Un poste en IP statique doit être reconfiguré à l''identique après reset.', 50, true, now(), now()),
  ('epj_sip',      'Vérifier le délai d''enregistrement SIP (UNYC)', 'Avant reset',         'UNYC : équipement de chaque utilisateur. Si le délai est dépassé, retirer l''équipement puis le réaffecter — les BLF ne sont pas perdues.', 60, true, now(), now()),
  ('epj_reset',    'Reset des téléphones',                        'Reset & autoprovision',  'À faire seulement une fois toutes les vérifications ci-dessus terminées.', 70, true, now(), now()),
  ('epj_autoprov', 'Renseigner l''URL d''autoprovision UNYC',     'Reset & autoprovision',  'https://titan.eqinoxe.com/sip-ps', 80, true, now(), now()),
  ('epj_routes',   'Vérifier routes d''appel, SVI, répondeur, renvois', 'Vérifications',     'Reproduire à l''identique les routes d''appel, le SVI, le répondeur et les renvois d''appel.', 90, true, now(), now()),
  ('epj_doko',     'Licences DOKO à migrer sur Speek',            'Client',                 'Demander au client s''il a des licences DOKO : elles se migrent vers Speek.', 100, true, now(), now()),
  ('epj_heures',   'Valider les heures d''intervention',          'Client',                 'Confirmer le créneau avec le client avant l''intervention.', 110, true, now(), now())
ON CONFLICT ("libelle") DO NOTHING;
