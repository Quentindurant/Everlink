# SPEC - Outil de provisionnement et bascule SEWAN vers UNYC

Document de référence pour l'implémentation. Cible: Claude Code CLI.

## 0. Contexte et objectif

Remplacer le Google Sheet "Provisionning numéros - Bascule SEWAN-UNYC" par une application web
hébergée sur Prisma Compute. Les onglets du Sheet deviennent des pages, ses formules deviennent des règles
serveur, ses onglets "Import SDA" et "Import MAC" deviennent des exports xlsx strictement conformes
aux templates fournis.

Fichiers de référence à placer dans `docs/samples/` et à versionner:

| Fichier | Rôle |
|---|---|
| `Migration_GC_1785166222.xlsx` | Export Monday, format d'entrée de l'import client |
| `Import_SDA_-_EVLOT0S27__1_.xlsx` | Template de sortie SDA, 101 lignes de données |
| `Import_MAC-_EVLOT0S27__1_.xlsx` | Template de sortie MAC, 116 lignes de données |
| Export du Sheet actuel | Reprise de données: 14 clients, 193 numéros, 121 MAC |

Ces trois xlsx servent de golden files pour les tests (section 11).

## 1. Stack et déploiement

- Next.js, App Router, TypeScript. Route Handlers et Server Actions pour l'API. Pas de NestJS:
  l'application est un back-office mono-consommateur, une seconde couche HTTP n'apporte rien.
  Si un besoin d'API externe apparaît plus tard, exposer `/api/v1` versionné depuis le même projet.
- PostgreSQL 16 et Prisma. Migrations Prisma versionnées, aucun `db push` en production.
- Tailwind et shadcn/ui. Grille de données: TanStack Table (tri, filtres, colonnes masquables,
  édition inline).
- Génération xlsx côté serveur: ExcelJS ou SheetJS. Vérifier le nom du paquet et l'API dans la doc
  au moment du scaffold, ne rien écrire de mémoire.
- Lecture des xlsx d'import: même bibliothèque que l'écriture.
- Auth: Auth.js provider credentials, table `UtilisateurApp`, rôles ADMIN et OPERATEUR.
  Pas d'inscription publique, création de comptes par un ADMIN.
- Déploiement: Prisma Compute (`bunx @prisma/cli@latest app deploy`), projet `proj_cms4grybr13xb06f3x712e3u0`,
  nom d'affichage "Everlink", région `eu-west-3`. `output: "standalone"` dans `next.config.ts`.
  Variables d'environnement posées via `bunx @prisma/cli@latest project env add`, jamais de `.env` committé.
  Migrations: `bunx prisma migrate deploy` contre la base du projet, jamais automatique au déploiement.
- Tâches planifiées: pas de conteneur worker. Endpoint `POST /api/cron/sheets-sync` protégé par un
  header `X-Cron-Secret`, appelé par un scheduler externe (à définir — la crontab VPS n'existe plus
  avec Prisma Compute).
- Variables d'environnement: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
  `GOOGLE_SHEET_ID`. Fournir un `.env.example`.

## 2. Modèle de données

Schéma Prisma complet dans `prisma/schema.prisma` (fourni). Principes:

- `Lot` regroupe des clients. Un lot porte un `nom` métier ("LOT 1a") et une `reference` technique
  utilisée pour nommer les exports ("EVLOT0S27").
- `Client` est identifié fonctionnellement par sa `raisonSociale`. C'est la clé de jointure des
  exports: la chaîne exportée doit être exactement celle attendue par UNYC, donc elle est stockée
  telle quelle et jamais reformatée.
- `Utilisateur` est un poste nominatif chez un client. Il est optionnel: un numéro peut exister sans
  utilisateur (numéro en stock), un équipement aussi (borne DECT).
- `Numero` et `Equipement` sont rattachés obligatoirement à un `Client` et optionnellement à un
  `Utilisateur`. C'est ce qui permet de représenter fidèlement le Sheet, où une ligne peut porter
  un numéro seul, un équipement seul, ou les deux.
- `ModeleEquipement` est le catalogue des modèles. Il porte le drapeau `eligibleExport` qui pilote
  le filtre des deux exports (section 6).
- `ListeValeur` porte toutes les listes déroulantes éditables (section 8).
- `EtapeModele` et `SuiviEtape` portent le suivi téléphonie, avec des étapes ajoutables.
- `ImportRun` et `ExportBatch` tracent chaque import et chaque export, avec le rapport et le
  décompte de lignes, pour pouvoir rejouer ou auditer.

Contraintes notables:

- Pas de contrainte d'unicité SQL sur `Numero.numeroNormalise`. Les données sources sont sales et un
  import ne doit jamais échouer en bloc. Les doublons sont détectés par le contrôle (section 5) et
  affichés comme anomalies.
- `Equipement.macNormalise` sert uniquement au dédoublonnage et à la recherche. L'export utilise
  `macBrut` nettoyé des espaces de bord, jamais la valeur normalisée.
- Suppressions: soft delete (`archiveA`) sur `Client`, `Numero`, `Equipement`, `Utilisateur`.
  Les entités archivées sortent des vues et des exports mais restent auditables.

## 3. Pages

Reprise stricte de la structure du Sheet, plus les pages de gestion.

### 3.1 Provisionning (page principale)

Grille éditable, une ligne par enregistrement, colonnes dans l'ordre du Sheet:

Client (raison sociale), Numéro à porter, Numéro court, Contrôle N°, Equipement, Adresse MAC
équipement, Utilisateur, Hébergeur source, Hébergeur cible, Bascule des numéros, Date bascule,
Commentaires.

Attendus:
- Groupement visuel par client, avec compteurs par groupe (numéros, MAC, bascules faites).
- Édition inline, validation à la cellule, sauvegarde optimiste avec rollback en cas d'erreur.
- Colonne Contrôle N° en lecture seule, calculée (section 5), avec le détail de l'anomalie au survol
  et une action "forcer OK" tracée (auteur, date, motif).
- Filtres: lot, client, hébergeur, statut de bascule, éligibilité export, présence d'anomalie.
- Recherche globale sur numéro, MAC, utilisateur, raison sociale.
- Ajout de ligne: numéro seul, équipement seul, ou ligne complète.
- Coller depuis Excel: prise en charge du collage multi-cellules dans la grille. Utile pour la saisie
  de masse, à traiter comme une amélioration et non comme un bloquant.
- Actions de masse sur la sélection: affecter un hébergeur cible, passer la bascule à Fait avec date,
  exclure ou réintégrer de l'export.

### 3.2 Clients

Une ligne par client: raison sociale, lot, nb numéros, nb MAC, bascules faites, statut global,
scénario, adresse, contact, nb de postes annoncé par Monday, écart entre postes annoncés et
équipements saisis.

Le Sheet compte les MAC par ligne, donc un MAC partagé par deux lignes est compté deux fois
(cas Polycom chez AART ELECTRONICS: 23 comptés, 22 distincts). Afficher les deux valeurs:
"MAC saisis" et "MAC distincts", et ne jamais utiliser le premier compte dans l'export.

Fiche client détaillée: onglets Numéros, Équipements, Utilisateurs, Suivi téléphonie, Historique.

### 3.3 Téléphone

Une ligne par utilisateur, avec le statut de chaque étape. Étapes actuelles, dans l'ordre:

1. Créer les utilisateurs
2. Mettre les équipements sur les utilisateurs
3. Mettre les BLF et raccourcis
4. Récupérer messages SVI, PRÉDÉCROCHÉ, ATTENTE, RÉPONDEUR
5. Configurer groupes d'appel, SVI, routes d'appel
6. Vérifier l'annuaire

Les étapes sont des données (`EtapeModele`), pas du code: ajout, renommage, réordonnancement et
désactivation depuis les paramètres. Statut par défaut "À faire", valeurs issues de `ListeValeur`.
Vue par client avec avancement en pourcentage, et bascule rapide d'une étape pour tous les
utilisateurs d'un client.

### 3.4 Import SDA et Import MAC

Deux pages de prévisualisation, strictement le contenu qui sera exporté, dans l'ordre exact du
fichier généré. Chaque page affiche le nombre de lignes, la répartition par client, et la liste des
lignes écartées avec le motif (modèle non éligible, pas de numéro, pas de MAC, doublon, exclusion
manuelle, client archivé). Bouton de téléchargement, et enregistrement d'un `ExportBatch`.

### 3.5 Lots

Liste des lots, création, référence d'export, clients rattachés, avancement.

### 3.6 Import Monday

Upload du xlsx, prévisualisation du mapping, rapport de rapprochement, validation. Détail en section 4.

### 3.7 Paramètres

Modèles d'équipement et éligibilité export, listes déroulantes, étapes de suivi, format de nom des
fichiers d'export, réglages de synchronisation Google Sheets, comptes utilisateurs.

## 4. Import Monday (xlsx)

Format observé sur `Migration_GC_1785166222.xlsx`, feuille `migration gc`:

- Ligne 1: titre du board ("Migration GC").
- Ligne 2: nom du groupe ("LOT 1a"). Un même fichier peut contenir plusieurs groupes: toute ligne
  dont une seule cellule est remplie, hors ligne d'en-tête, est un séparateur de groupe et définit
  le lot des lignes suivantes.
- Ligne 3: en-têtes, 47 colonnes.
- Lignes 4 à n: un client par ligne.
- Dernière ligne: totaux (NB DE POSTE renseigné, Name vide). À ignorer.

Mapping minimal à implémenter (les autres colonnes sont stockées dans `Client.mondayRaw` en Json):

| Colonne Monday | Champ |
|---|---|
| Name | `codeMonday` (ex POCGC025) |
| Filiale | `filiale` |
| Raison sociale | `raisonSociale` |
| Scénario | `scenario` |
| Adresse | `adresse` |
| Date d'inter | `dateIntervention` |
| Clt VIP | `clientVip` |
| Intervention | `typeIntervention` |
| Statut | `statutMonday` |
| Commentaire | `commentaire` |
| NB DE POSTE | `nbPostesAnnonce` |
| Nom (contact), Prénom (contact) | `contactNom`, `contactPrenom` |
| Fixe (contact), Mobile (contact), Mail (contact) | `contactFixe`, `contactMobile`, `contactEmail` |
| Techno lien, Débit, Modèle CPE | `technoLien`, `debit`, `modeleCpe` |
| Postes déployées | `postesDeployesRaw` plus création des `ModeleEquipement` manquants |
| LOT, Département | `lot`, `departement` |

Règles:
- Rapprochement par `codeMonday` en priorité, sinon par `raisonSociale` normalisée (majuscules,
  espaces multiples réduits, accents conservés). Aucun rapprochement flou automatique: en cas de
  doute, la ligne est présentée en "à rapprocher" avec les candidats proposés, l'opérateur tranche.
- Import idempotent: rejouer le même fichier ne crée pas de doublons et ne perd aucune saisie locale.
  Les champs issus de Monday sont mis à jour, les champs saisis dans l'application ne sont jamais
  écrasés.
- `Postes déployées` est une liste séparée par des virgules ("Yealink T57W, Yealink W90DM, Panasonic
  TGP600"). Chaque libellé inconnu crée un `ModeleEquipement` avec `eligibleExport` déduit de la
  marque (Yealink vrai, autre faux) et signalé dans le rapport d'import pour validation humaine.
  Cet import ne crée pas d'équipements: il alimente le catalogue et sert de contrôle de cohérence
  face aux MAC réellement saisis.
- Dates: cellules déjà typées date dans le xlsx, ne pas parser de chaîne.
- Téléphones de contact: stockés bruts, formats hétérogènes dans la source ("155959393",
  "07 57 00 71 66").
- Rapport d'import: créés, mis à jour, ignorés, à rapprocher, modèles inconnus. Persisté en
  `ImportRun`, consultable et exportable.

## 5. Contrôle N°

Le Sheet affiche "OK" dans la colonne Contrôle N°. La règle exacte n'est pas documentée: implémenter
un contrôle composite, non bloquant, affiché comme OK ou ANOMALIE avec le détail.

Vérifications:
1. Après normalisation (suppression des espaces, points, tirets, conversion `+33X` vers `0X`), le
   numéro fait 10 chiffres et commence par 0.
2. Préfixe plausible: 01 à 05, 09 pour les non géographiques. Signaler 06, 07 et 08 sans bloquer.
3. Unicité globale du numéro normalisé sur les lots actifs.
4. Cohérence: si un utilisateur est renseigné, un équipement devrait l'être aussi, et inversement.
   Anomalie de niveau avertissement.
5. Numéro court: format libre, plusieurs valeurs séparées par `/`. Vérifier l'unicité des numéros
   courts au sein d'un même client.

Trois niveaux: OK, AVERTISSEMENT, ERREUR. Une action "forcer OK" est disponible sur les avertissements
et les erreurs, avec motif obligatoire, auteur et horodatage. Le statut forcé est visible dans la
grille et n'est pas écrasé par un recalcul.

Le contrôle est recalculé à l'écriture et disponible en recalcul global depuis les paramètres.

## 6. Règles d'export

Règles déduites des deux templates fournis, vérifiées client par client contre le Sheet source.
Elles sont implémentées comme configuration, pas en dur.

### 6.1 Filtre d'éligibilité

Seuls les équipements dont le `ModeleEquipement.eligibleExport` est vrai sortent, dans les deux
exports. Dans les fichiers fournis, cela correspond aux Yealink uniquement. Sont exclus: Panasonic
TGP500 et TGP600, Polycom (VVX400, IP5000, RealPresence Trio 8300), DOKO, FAX, Aastra.

Preuves de la règle:
- ENGCON FRANCE: 7 numéros équipés dans le Sheet, 4 lignes SDA (2 Panasonic et 1 DOKO retirés).
- AART ELECTRONICS: 21 numéros, 18 lignes SDA (2 lignes Polycom et 1 DOKO retirées).
- CEPY ASSURANCES: 17 numéros, 15 lignes SDA (2 FAX retirés).
- KYPE AUDIT ET CONSEIL: 15 numéros équipés, 6 lignes SDA (1 Panasonic et 8 DOKO retirés).

Le seed initialise le catalogue avec ces valeurs. L'écran Paramètres permet de basculer l'éligibilité
d'un modèle, ce qui change immédiatement le contenu des deux prévisualisations.

### 6.2 Export SDA

- Une ligne par numéro rattaché à un utilisateur disposant d'un équipement éligible.
- Les numéros sans utilisateur et sans équipement (blocs de numéros en stock en bas de chaque client
  dans le Sheet) ne sortent pas.
- Tri: par raison sociale croissante, puis ordre de saisie au sein du client.
- Colonnes: `Client (raison sociale)`, `Numéro à porter`.
- Le numéro est écrit en texte, format de cellule `@`, zéro initial conservé.
- Feuille nommée `Feuil1`. Filtre automatique posé sur `A1:B1`. Largeurs: A 48, B 15.
  En-têtes non gras.
- Référence: 101 lignes de données pour le lot fourni.

### 6.3 Export MAC

- Une ligne par adresse MAC d'équipement éligible, y compris les équipements sans utilisateur
  (bornes DECT W70B, W90B, W90DM).
- Une cellule contenant deux adresses séparées par `&` produit deux lignes.
- Dédoublonnage par MAC normalisée au sein d'un même client.
- Tri: ordre de saisie des clients (ordre du lot), puis ordre de saisie des équipements.
  Pas de tri alphabétique, contrairement au SDA.
- Colonnes: `Client (raison sociale)`, `Adresse MAC équipement`.
- Valeur exportée: la MAC saisie, espaces de bord supprimés, sans autre transformation. Les IPUI DECT
  à 10 caractères hexadécimaux (`030AD2466B`) et les MAC à deux-points (`80:5E:0C:53:D6:70`)
  coexistent telles quelles. Ne jamais uniformiser la casse ni les séparateurs.
- Feuille nommée `Feuil1`, pas de filtre automatique. Largeurs: A 48, B 22.71. En-têtes non gras.
- Référence: 116 lignes de données pour le lot fourni.

### 6.4 Portée et nommage

Portée sélectionnable: un lot entier, un client, ou une sélection manuelle de clients. Les clients
déjà basculés ne sont pas exclus par défaut: dans le fichier fourni, ETIKEO est présent alors que sa
bascule est marquée "Fait". Prévoir une case "exclure les clients déjà basculés", décochée par défaut.

Nom de fichier par défaut, paramétrable: `Import_SDA_-_<REFERENCE_LOT>.xlsx` et
`Import_MAC-_<REFERENCE_LOT>.xlsx`, en respectant l'espace avant le tiret pour le SDA et son absence
pour le MAC, comme dans les fichiers fournis.

## 7. Reprise et synchronisation Google Sheets

### 7.1 Reprise initiale

Commande `pnpm import:sheet <fichier.xlsx|csv>` et écran d'import équivalent. Elle lit l'onglet
Provisionning et reconstruit clients, utilisateurs, numéros et équipements.

Particularités de la source à gérer explicitement, toutes constatées dans les données fournies:

- Un client est un bloc de lignes consécutives. Les lignes ne portant que la raison sociale et un
  numéro sont des numéros en stock, sans utilisateur ni équipement.
- Lignes sans numéro mais avec équipement: bornes DECT, à créer comme équipements sans utilisateur.
- MAC multiples dans une cellule, séparateur `&`.
- Espaces parasites en début de MAC et de nom d'utilisateur, tabulation en début de numéro court
  (`\t457 / 4057`).
- Numéros avec espaces (`01 80 87 33 45`) à normaliser à la lecture, valeur brute conservée.
- Fautes de frappe dans les modèles: `Yealnik w90B` pour `Yealink W90B`. Table d'alias dans le seed,
  et rapport des libellés non reconnus.
- Casse des modèles hétérogène: `Yealink w73H` et `Yealink W73H` sont le même modèle.
- Commentaires porteurs d'information technique non structurée: "a en plus un PANASONIC TGP600
  BC:C3:42:F8:7A:7B". Ne pas parser, conserver le commentaire tel quel. Ces MAC ne sont pas exportées
  puisqu'elles ne sont pas dans la colonne MAC.
- Client sans donnée: SZUMNY GABRIEL PERI, commentaire "CLIENT NON TROUVER". Créer le client, aucune
  ligne rattachée.
- Onglets générés du Sheet contenant des `#REF!`: ne pas importer, ils sont recalculés par
  l'application.

L'import produit un rapport détaillé et est rejouable sans doublon (clé: raison sociale plus numéro
normalisé, ou raison sociale plus MAC normalisée).

### 7.2 Synchronisation

L'application est la source de vérité. La synchronisation est sortante uniquement, en écrasement des
onglets cibles du Sheet: Provisionning, Clients, Téléphone, Import SDA, Import MAC.

- Authentification par compte de service Google, le Sheet étant partagé en écriture avec l'adresse du
  compte de service. Utiliser le client Node officiel Google APIs et l'API Sheets v4. Vérifier le nom
  du paquet, sa version et la signature des méthodes dans la doc avant d'écrire le code.
- Déclenchement manuel depuis l'interface et automatique par un scheduler externe (voir §1) via
  `POST /api/cron/sheets-sync`.
- Journalisation de chaque synchronisation: date, onglets écrits, nombre de lignes, erreurs.
- La synchronisation entrante (Sheet vers application) n'est pas implémentée. Toute modification
  faite dans le Sheet sera écrasée. Afficher cet avertissement dans l'écran de paramétrage et écrire
  un bandeau en ligne 1 des onglets synchronisés indiquant que le fichier est généré.

Si une reprise ponctuelle depuis le Sheet redevient nécessaire, passer par l'import de fichier de la
section 7.1 avec prévisualisation des différences.

## 8. Listes déroulantes

Table `ListeValeur`, éditable dans Paramètres, avec ordre d'affichage et désactivation sans
suppression. Catégories initiales:

| Catégorie | Valeurs de départ |
|---|---|
| HEBERGEUR | SEWAN, UNYC |
| STATUT_BASCULE | À faire, En cours, Fait, Bloqué |
| STATUT_ETAPE | À faire, En cours, Fait, Sans objet |
| SCENARIO | CENTREX only, Lien + CENTREX, Lien + CENTREX + 4G/5G |
| TYPE_INTERVENTION | Sur site, A distance |
| STATUT_MONDAY | New, En cours, Terminé |
| TECHNO_LIEN | FTTH, FTTO, Copper, FTTH + 4G/5G, NC |

Les modèles d'équipement sont gérés à part, dans `ModeleEquipement`, car ils portent des attributs
(marque, type, éligibilité export, alias) et pas seulement un libellé.

Une valeur utilisée par au moins un enregistrement ne peut pas être supprimée, seulement désactivée.
Un champ dont la valeur courante a été désactivée continue de l'afficher, marquée comme obsolète.

## 9. Interconnexion des entités

Exigence explicite du besoin: tout doit être relié. Concrètement:

- Depuis un numéro: accès au client, à l'utilisateur, à l'équipement du même utilisateur, à l'état
  d'avancement des étapes de cet utilisateur.
- Depuis une MAC: accès au modèle, à l'utilisateur, au numéro, au client, à l'éligibilité export avec
  le motif.
- Depuis un client: numéros, MAC, utilisateurs, suivi téléphonie, données Monday, exports générés,
  historique des modifications.
- Depuis un modèle d'équipement: tous les équipements concernés, tous les clients concernés, impact
  d'un changement d'éligibilité sur le nombre de lignes exportées.
- Recherche globale unique renvoyant clients, numéros, MAC et utilisateurs.
- Historique: table `AuditLog` alimentée sur création, modification et suppression, avec entité, id,
  champ, ancienne valeur, nouvelle valeur, auteur, date.

## 10. Sécurité et exploitation

- Deux rôles: ADMIN (paramètres, comptes, imports, exports) et OPERATEUR (saisie, exports).
- Sauvegarde Postgres quotidienne par `pg_dump` dans un volume monté, rétention 30 jours,
  script fourni dans `scripts/backup.sh`.
- Journal applicatif structuré en JSON sur stdout.
- Endpoint `/api/health` pour la supervision.

## 11. Tests d'acceptation

Non négociables, à écrire avant l'implémentation des exports.

1. Après import du Sheet fourni, l'export SDA du lot produit exactement 101 lignes de données, avec
   la répartition suivante:

   AART ELECTRONICS 18, AVA 10, BOREAL HYGIENE 6, CEPY ASSURANCES 15,
   CORNIER PIERRE-NOEL LOUIS RENE JEAN 5, EBK IMMO JOFFRE IMMOBILIER GARE 5,
   EBK IMMO JOFFRE IMMOBILIER MARCHE 5, ENGCON FRANCE 4, ETIKEO 6,
   FEDERATION NATIONALE DE L'HOTELLERIE DE PLEIN AIR 4, ID INFORMATIQUE 9,
   KYPE AUDIT ET CONSEIL 6, SZUMNY REPUBLIQUE 8.

2. Après le même import, l'export MAC produit exactement 116 lignes, dans l'ordre des clients du lot:

   EBK IMMO JOFFRE IMMOBILIER GARE 6, EBK IMMO JOFFRE IMMOBILIER MARCHE 6, BOREAL HYGIENE 8,
   ENGCON FRANCE 5, ID INFORMATIQUE 9, AART ELECTRONICS 22,
   FEDERATION NATIONALE DE L'HOTELLERIE DE PLEIN AIR 4, ETIKEO 6,
   CORNIER PIERRE-NOEL LOUIS RENE JEAN 6, SZUMNY REPUBLIQUE 12, AVA 11, CEPY ASSURANCES 15,
   KYPE AUDIT ET CONSEIL 6.

3. Comparaison cellule à cellule des deux fichiers générés avec les golden files de `docs/samples/`:
   valeurs, ordre des lignes, nom de la feuille, format de cellule des numéros, largeurs de colonnes,
   présence du filtre automatique sur le SDA et son absence sur le MAC.

4. Les MAC exportées sont identiques aux valeurs saisies, espaces de bord exclus. Test dédié sur
   `030AD2466B` (IPUI DECT, sans séparateur) et `80:5E:0C:53:D6:70` (saisie avec espace initial).

5. La cellule `80:5E:0C:DD:8D:E9 & 80:5E:0C:DA:BF:DA` chez AART ELECTRONICS produit deux lignes.

6. Rejouer l'import Monday deux fois de suite ne crée aucun doublon et ne modifie aucun champ saisi
   dans l'application.

7. Basculer `eligibleExport` de Panasonic TGP600 à vrai fait passer l'export SDA de 101 à 105 lignes
   (2 ENGCON, 1 KYPE, 2 FNHPA font 5, à recalculer précisément à l'implémentation contre les données
   importées, le test doit vérifier la variation et non une valeur écrite en dur).

## 12. Découpage proposé

1. Scaffold, Prisma Compute, Postgres, Prisma, auth, seed des listes et du catalogue de modèles.
2. Modèle de données complet et migrations.
3. Import du Sheet existant, avec rapport. C'est le jeu de données de tous les tests suivants.
4. Exports SDA et MAC, avec les tests d'acceptation de la section 11.
5. Page Provisionning avec édition inline et contrôles.
6. Pages Clients, Téléphone, Lots.
7. Import Monday.
8. Paramètres, listes déroulantes, catalogue de modèles.
9. Synchronisation Google Sheets sortante.
10. Audit, sauvegardes, supervision.

## 13. Points laissés ouverts

Codés avec une valeur par défaut, à confirmer et modifiables sans changement de code:

1. Filtre d'export: implémenté comme "modèle marqué éligible", initialisé à Yealink uniquement,
   conformément aux fichiers fournis. Si la règle réelle est différente (par exemple liée à la
   compatibilité UNYC et non à la marque), seule la valeur du drapeau change.
2. Contrôle N°: règle composite proposée en section 5, non bloquante. À ajuster si le Sheet appliquait
   une vérification précise (présence au contrat SEWAN par exemple).
3. Portée d'export: lot, client ou sélection. Hypothèse que `EVLOT0S27` est la référence du lot.
4. EBK IMMO JOFFRE IMMOBILIER GARE et MARCHE sont traités comme deux clients distincts, car la
   raison sociale est la clé d'export attendue par UNYC. Le champ `filiale` et le champ `groupe`
   permettent de les regrouper dans l'interface sans changer la clé.
5. Suivi téléphonie modélisé par utilisateur, comme dans le Sheet, avec agrégation par client.
6. Authentification par comptes nominatifs. Peut être réduite à un mot de passe unique si le besoin
   est un usage strictement interne mono-opérateur.
