# Statuts + flux de migration — Design

**Date :** 2026-07-31
**Chantier :** 1/4 des améliorations issues des CR COPIL (les autres : mails auto, suivi du lien ADV, tri techniciens).
**Objectif :** transformer le statut de bascule (aujourd'hui 4 valeurs plates par numéro et par client) en un **parcours de migration niveau client**, riche et très lisible, aligné sur le process réel des CR.

## 0. Contexte

Le statut actuel :
- `Numero.statutBascule` : "À faire / En cours / Fait / Bloqué" (par numéro).
- `Client.statutBascule` : idem au niveau client. Utilisé par les exports (scope "exclure les clients déjà basculés", `syncRepository.clientScopeWhere` teste `statutBascule != "Fait"`) et par la synchro Sheet (`fetchClientsData` → `statutGlobal`).

Les CR décrivent un vrai parcours par client : prévenance J-15 → contact (3 jours ouvrés) → RDV → livraison du lien → bascule → post-migration J+7. La bascule d'un numéro est un détail de l'étape "Bascule faite".

## 1. Périmètre

**Dans le périmètre :**
- Parcours de migration configurable au niveau client.
- Visuel fort : badges couleur, stepper sur la fiche client, colonne/filtre par étape.
- Suivi des tentatives de contact + flux Bloqué.
- Champ `referenceClient` (nomenclature `EV VTO0907 : XXXXX`).
- Section Paramètres pour éditer les étapes.

**Hors périmètre (chantiers suivants) :**
- Auto-avancement d'étape à l'envoi d'un mail (chantier 2 — mails).
- Détail du suivi de commande de lien opérateur (chantier 3 — lien ADV).
- Tri des techniciens (chantier 4).

Ici, l'étape se change **à la main** via un menu déroulant.

## 2. Modèle de données

### 2.1 Nouveau modèle `EtapeMigration`

```prisma
model EtapeMigration {
  id         String   @id @default(cuid())
  libelle    String   @unique
  ordre      Int
  // Couleur hex du badge et du stepper (ex "#1f6bff").
  couleur    String   @default("#667085")
  // Une étape bloquante (Bloqué) est signalée en rouge et sort le client du flux nominal.
  estBloquant Boolean @default(false)
  actif      Boolean  @default(true)
  creeLe     DateTime @default(now())
  majLe      DateTime @updatedAt

  clients    Client[]

  @@index([ordre])
}
```

Seed initial (8 étapes, ordre + couleur) :

| ordre | libelle | couleur | estBloquant |
|---|---|---|---|
| 0 | À qualifier | #98a2b3 | false |
| 1 | Prévenance envoyée | #1f6bff | false |
| 2 | Contact en cours | #00b8cc | false |
| 3 | Bloqué | #f04438 | true |
| 4 | RDV planifié | #8a5bff | false |
| 5 | Lien livré | #ffb020 | false |
| 6 | Bascule faite | #16b57f | false |
| 7 | Post-migration J+7 | #0e7a56 | false |

### 2.2 Champs ajoutés sur `Client`

```prisma
etapeMigration    EtapeMigration? @relation(fields: [etapeMigrationId], references: [id])
etapeMigrationId  String?
nbTentativesContact Int      @default(0)
dernierContactLe    DateTime?
referenceClient     String?   // nomenclature "EV VTO0907 : XXXXX"
```

`Numero.statutBascule` **inchangé** (reste le détail par numéro dans l'étape "Bascule faite").

### 2.3 Migration des usages de `Client.statutBascule`

`etapeMigration` devient la source de vérité au niveau client. Un client est considéré **basculé** quand son étape a `ordre >= ordre("Bascule faite")` (étapes terminales).

- **Exports** (`syncRepository.clientScopeWhere`) : l'option "exclure les clients déjà basculés" filtre désormais sur l'étape terminale au lieu de `statutBascule == "Fait"`.
- **Sync Sheet** (`fetchClientsData` → `statutGlobal`) : renvoie le `libelle` de l'étape de migration.
- `Client.statutBascule` est **conservé en base** (non supprimé) pour ne pas casser d'éventuelles données, mais n'est plus lu par l'app. À nettoyer dans un chantier ultérieur si besoin.

## 3. Domaine (logique pure, testée)

`lib/domain/migration/etapes.ts` :

```ts
export interface EtapeMigrationLite { id: string; libelle: string; ordre: number; couleur: string; estBloquant: boolean; }

// Un client est basculé si son étape courante est au niveau de la 1re étape terminale ou au-delà.
// La 1re étape terminale = première étape (par ordre) dont le libellé figure dans TERMINALES,
// sinon on retombe sur la dernière étape non bloquante.
export const ETAPE_TERMINALE = "Bascule faite";
export function estBasculee(etape: EtapeMigrationLite | null, etapes: EtapeMigrationLite[]): boolean;

// Seuil de tentatives de contact au-delà duquel on suggère le passage en Bloqué.
export const SEUIL_TENTATIVES = 3;
export function doitSuggererBloque(nbTentatives: number, etapeCourante: EtapeMigrationLite | null): boolean;
```

Tests (`etapes.test.ts`) : `estBasculee` vrai pour "Bascule faite"/"Post-migration" et faux avant ; `doitSuggererBloque` vrai à partir de 3 tentatives quand l'étape n'est pas déjà bloquante/terminale.

## 4. Visuel

- **Badge d'étape** : pastille pleine à la `couleur` de l'étape, texte lisible. Composant réutilisable `EtapeMigrationBadge`.
- **Stepper** sur la fiche client : les étapes actives en ligne, l'étape courante mise en avant, les précédentes cochées, les suivantes grisées. L'étape bloquante affichée en rouge hors ligne nominale.
- **Grille Provisionning** : la bande client affiche le badge d'étape en évidence, avec un sélecteur pour changer d'étape (menu déroulant costaud, comme le sélecteur de modèle). Teinte de fond de la bande client selon la couleur de l'étape (légère).
- **Page Clients** : colonne "Étape" (badge) + filtre par étape.
- **Provisionning** : filtre par étape de migration dans la barre de filtres.

## 5. Flux Bloqué / contact

- Sur la fiche client (et la bande client de la grille) : bouton **"Noter une tentative de contact"** → `nbTentativesContact += 1`, `dernierContactLe = now()`.
- Affichage : "X tentative(s) · dernière le JJ/MM".
- Quand `doitSuggererBloque` est vrai : encart d'alerte + bouton **"Passer en Bloqué"** (met l'étape sur l'étape `estBloquant`).
- Changer d'étape se fait via le sélecteur ; passer en Bloqué est un raccourci.

## 6. Paramètres (ADMIN)

Nouvelle section **"Étapes de migration"** dans la page Paramètres, sur le modèle de la section "Étapes de suivi" :
- Liste ordonnée, ajout, renommage, réordonnancement (haut/bas), activation/désactivation.
- Édition de la couleur (input `type=color`) et du drapeau `estBloquant`.
- Une étape utilisée par au moins un client ne peut être supprimée, seulement désactivée (règle SPEC §8).

Repository : étendre `lib/repositories/parametresRepository.ts` (fonctions `fetchEtapesMigration`, `ajouterEtapeMigration`, `renommerEtapeMigration`, `setCouleurEtapeMigration`, `setEtapeMigrationBloquant`, `deplacerEtapeMigration`, `setEtapeMigrationActif`).

## 7. Actions serveur

`app/(app)/clients/[id]/actions.ts` (ou actions provisionning) :
- `setEtapeMigrationAction(clientId, etapeMigrationId)` — change l'étape.
- `noterTentativeContactAction(clientId)` — incrémente + horodate.
- `passerBloqueAction(clientId)` — met l'étape bloquante.
- `updateReferenceClientAction(clientId, valeur)` — édite la nomenclature.

Toutes gardées par `auth()` (OPERATEUR autorisé pour la saisie).

## 8. Découpage (pour le plan d'implémentation)

1. Migration Prisma : `EtapeMigration` + champs Client + seed des 8 étapes.
2. Domaine + tests (`estBasculee`, `doitSuggererBloque`).
3. Repository étapes (Paramètres) + section Paramètres "Étapes de migration".
4. Badge + stepper + sélecteur d'étape (composants).
5. Intégration grille Provisionning (bande client) + page Clients (colonne + filtre).
6. Flux contact/Bloqué (actions + UI fiche client).
7. Bascule des usages `Client.statutBascule` → `etapeMigration` dans exports + sync.
8. Vérif visuelle + build + déploiement.

## 9. Points ouverts

- Couleurs du seed : proposées d'après l'identité visuelle de la refonte, ajustables ensuite dans Paramètres.
- Seuil de 3 tentatives : constante `SEUIL_TENTATIVES`, ajustable (pas de config UI dans ce chantier).
- Stepper compact dans la grille : d'abord un simple badge + sélecteur ; le stepper complet vit sur la fiche client.
