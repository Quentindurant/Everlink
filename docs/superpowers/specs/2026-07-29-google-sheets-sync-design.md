# Synchronisation Google Sheets sortante — design

Date: 2026-07-29

## Contexte

SPEC.md §7.2 spécifie une synchronisation sortante uniquement (application → Sheet), en écrasement
de cinq onglets: Provisionning, Clients, Téléphone, Import SDA, Import MAC. La reprise initiale
(§7.1, import de fichier) n'est pas encore construite — la base est vide au moment où cette
fonctionnalité est développée. Décision (utilisateur, 2026-07-29): construire la synchronisation
maintenant malgré la base vide, plutôt que d'attendre la reprise. Les cinq onglets sont construits
en une fois, y compris Provisionning/Clients/Téléphone dont la logique amont (Contrôle N°, pages
UI) n'existe pas encore — ces colonnes lisent les valeurs par défaut du schéma (ex.
`Numero.controleNiveau` vaut `OK` par défaut) plutôt que d'être calculées finement.

Les identifiants Google (compte de service + ID du Sheet) sont déjà posés en variable
d'environnement production sur Prisma Compute (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`).

## Architecture

- Package `googleapis` (client Node officiel), API Sheets v4. Authentification via
  `google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON), scopes })`
  — lit le JSON directement depuis la variable d'environnement, aucun fichier de clé sur disque en
  production.
- `lib/domain/sync/` — fonctions pures de mapping (lignes DB → tableaux de lignes Sheet), sans
  dépendance Prisma ni Google, testables unitairement. Cohérent avec la convention CLAUDE.md
  (logique métier pure dans `lib/domain/`).
- `lib/domain/exports/sda.ts` et `mac.ts` — logique de filtre/tri/dédoublonnage des exports SDA et
  MAC (§6.2, §6.3), fonctions pures partagées entre l'onglet de synchronisation et la future
  fonctionnalité d'export xlsx réel — implémentées une seule fois, pas dupliquées.
- `lib/repositories/syncRepository.ts` — requêtes Prisma alimentant chaque onglet.
- `lib/google/sheetsClient.ts` — wrapper fin autour de l'API Sheets (authentification, écriture).
- `lib/sync/runSheetsSync.ts` — orchestrateur: récupération, mapping, écriture, journalisation.
  Fonction unique réutilisée par les deux points de déclenchement actuels.

## Modèle de données

Nouveau modèle, même forme que `ImportRun`/`ExportBatch` déjà présents dans le schéma:

```prisma
enum DeclencheurSync {
  MANUEL
  CRON
  CLI
}

model SheetSyncRun {
  id            String          @id @default(cuid())
  declencheur   DeclencheurSync
  ongletsEcrits Json            // { "Provisionning": 42, "Clients": 8, ... }
  erreurs       Json?           // { "Téléphone": "message erreur" } — par onglet en échec
  succes        Boolean         @default(true)

  auteur   UtilisateurApp? @relation(fields: [auteurId], references: [id])
  auteurId String?

  creeLe DateTime @default(now())

  @@index([creeLe])
}
```

`UtilisateurApp` reçoit la relation inverse `syncRuns SheetSyncRun[]`, comme ses relations
existantes `importRuns`/`exportBatchs`.

## Mapping par onglet

Colonnes fixées par SPEC.md §3.1, §3.2, §6.2, §6.3 — non réinventées ici.

- **Provisionning**: une ligne par `Numero` (jointure `Client`, `Utilisateur`, `Equipement`), plus
  les `Equipement` orphelins sans `utilisateurId` en fin de liste (bornes DECT). Colonne
  `Contrôle N°` = `numero.controleNiveau` (défaut `OK`, moteur de règles §5 à venir).
- **Clients**: une ligne par `Client` — `raisonSociale`, `lot.nom`, nombre de `Numero` actifs,
  nombre de MAC (saisis = nombre de lignes, distincts = par `macNormalise`), nombre de `Numero` où
  `statutBascule = "Fait"`, `statutBascule` (comme "statut global"), `scenario`, `adresse`, contact
  (`contactNom` + `contactPrenom`), `nbPostesAnnonce`, écart = `nbPostesAnnonce` moins nombre
  d'équipements.
- **Téléphone**: une ligne par `Utilisateur`, colonnes dynamiques = `EtapeModele.libelle` triés par
  `ordre`, cellule = `SuiviEtape.statut` correspondant (défaut `"À faire"` si aucune ligne
  `SuiviEtape` n'existe encore).
- **Import SDA** / **Import MAC**: règles exactes §6.2/§6.3 (filtre d'éligibilité, tri,
  dédoublonnage), via les fonctions partagées `lib/domain/exports/sda.ts` et `mac.ts`.

## Écriture et gestion d'erreur

Par onglet, conformément au bandeau requis par §7.2:
- Ligne 1: bandeau — `"⚠ Fichier généré automatiquement par Everlink — toute modification sera écrasée"`
- Ligne 2: en-têtes
- Ligne 3+: données

Écriture via `spreadsheets.values.update`, `valueInputOption: "RAW"`, plage couvrant l'étendue
ancienne et nouvelle (efface puis écrit en un appel, pour ne pas laisser de lignes obsolètes si les
données rétrécissent).

Les cinq onglets sont indépendants: l'échec d'un onglet n'empêche pas les autres. L'orchestrateur
traite chaque onglet, capture les erreurs individuellement, continue, et `SheetSyncRun` enregistre
`ongletsEcrits` et `erreurs` partiels. `succes = false` si au moins un onglet a échoué, mais les
onglets réussis sont tout de même écrits — cohérent avec l'invariant métier "un import ne doit
jamais échouer en bloc", appliqué ici à la synchronisation.

## Points de déclenchement

- `POST /api/cron/sheets-sync` — vérifie l'en-tête `X-Cron-Secret` contre `CRON_SECRET`
  (correspondance exacte, 401 sinon), appelle l'orchestrateur, `declencheur: CRON`.
- `bun run sync:sheets` (nouveau script `package.json`) — appelle directement l'orchestrateur, sans
  HTTP ni vérification de secret (usage local/manuel en attendant le bouton d'interface),
  `declencheur: CLI`.
- Bouton d'interface réel (plus tard, une fois la page Paramètres construite) réutilisera le même
  orchestrateur via une Server Action, `declencheur: MANUEL`.

## Tests

Les cinq fonctions de mapping dans `lib/domain/` sont pures: tests unitaires avec des lignes DB de
fixture en entrée, assertions sur les tableaux de lignes produits, sans réseau ni base de données.
Le client Google et les requêtes Prisma ne sont pas testés unitairement (wrappers d'E/S fins) —
vérifiés par une exécution réelle contre le Sheet une fois construits.

## Hors scope

- Reprise initiale (§7.1, import de fichier) — fonctionnalité séparée, traitée dans un travail
  ultérieur.
- Synchronisation entrante (Sheet → application) — explicitement non implémentée par SPEC.md §7.2.
- Bouton d'interface de déclenchement manuel — dépend de la page Paramètres, pas encore construite.
- Moteur de règles de Contrôle N° (§5) — les colonnes concernées lisent les valeurs par défaut du
  schéma en attendant.
