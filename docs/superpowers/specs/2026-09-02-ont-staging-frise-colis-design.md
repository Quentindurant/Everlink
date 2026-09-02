# Récupération des ONT et frise de livraison

Date : 2026-09-02

Deux sujets liés par le staging : tracer les ONT repris chez les clients jusqu'à leur retour
au grossiste, et rendre lisible l'avancement d'un colis.

## Contexte

Lors d'une migration SEWAN → UNYC, le chef de projet reprend l'ONT du client le jour de
l'installation. Ces appareils repartent ensuite au grossiste, par lots. Aujourd'hui rien ne
les suit : ni le numéro de série, ni le client d'origine, ni la date de retour. Un ONT qui ne
revient jamais ne se voit nulle part.

Le staging gère déjà un stock générique (`ArticleStock`) avec numéro de série, client lié,
statuts et suivi transporteur. Aucun article de type `ONT` n'existe en production à ce jour :
le flux est neuf, mais le modèle qui l'accueille ne l'est pas.

## Partie 1 — Les ONT

### Modèle

L'ONT est un `ArticleStock`, pas une entité à part :

- `type = "ONT"`
- `origine = "CLIENT"` — champ existant, documenté comme « routeur récupéré chez le client le
  jour de l'install ». C'est exactement ce cas.
- `numeroSerie`, `clientId` : déjà là.
- `statut = "EN_STOCK"` dès la saisie par le chef de projet, `"ENVOYE"` au départ du lot.

Trois ajouts seulement :

- `ArticleStock.lotRetourId` (nullable) — le lot de retour auquel l'ONT appartient.
- `ArticleStock.suiviEtape` (nullable) — l'étape de frise, partie 2 ci-dessous.
- table `LotRetourOnt`.

`ArticleStock.dateReception` existe déjà et sert exactement à la coche du staging : renseignée,
l'ONT est physiquement arrivé ; vide, il est saisi mais pas encore là. Aucun champ neuf, et la
liste « saisis mais jamais arrivés » tombe gratuitement d'un `dateReception: null`.

```prisma
model LotRetourOnt {
  id           String    @id @default(cuid())
  destinataire String                          // grossiste
  transporteur String?                         // "Chronopost" | "DHL"
  numeroSuivi  String?
  expedieLe    DateTime?                       // null = lot encore ouvert

  // Mêmes noms que ArticleStock : le cron de tracking traite les deux sans cas particulier.
  suiviStatut  String?
  suiviLibelle String?
  suiviEtape   Int?
  suiviLivreLe DateTime?
  suiviMajLe   DateTime?

  articles ArticleStock[]
  creeLe   DateTime @default(now())
  majLe    DateTime @updatedAt

  @@index([numeroSuivi])
  @@index([expedieLe])
}
```

Un lot ouvert n'a ni transporteur, ni numéro, ni date d'expédition. On le clôt en les
saisissant. Un seul lot ouvert à la fois : c'est le panier courant du staging.

### Étape chef de projet

Une `EtapeProjet` « Récupérer l'ONT », dans la phase du jour de l'installation. Elle ne se
coche pas comme les autres — elle réclame une saisie :

- soit un **numéro de série**, qui crée l'`ArticleStock` rattaché au client et passe l'étape à
  `Fait` ;
- soit une **raison** (« pas d'ONT sur place », « ONT encastré dans la baie »), qui passe
  l'étape à `Aucun` et range le texte dans `SuiviProjet.commentaire`. Aucun article n'est créé.

Sans l'un ou l'autre, l'étape reste ouverte. Le statut `Aucun` existe déjà et compte dans la
jauge de progression.

Un numéro de série déjà présent en base est refusé avec le nom du client qui le détient : deux
clients ne peuvent pas rendre le même appareil, et c'est le signe d'une faute de frappe.

### Écran staging

Une tuile « ONT » sur `/staging`, menant à une page à trois zones :

1. **Annoncés** — `dateReception: null`. Une coche par ligne, qui pose la date du jour. C'est
   la zone qui révèle les appareils perdus entre le site et le staging.
2. **Lot en préparation** — le lot ouvert. On y verse les ONT reçus, on le clôt en saisissant
   destinataire, transporteur et numéro de suivi ; ses articles passent alors à `ENVOYE`.
   Seul un ONT dont la réception est cochée peut entrer dans un lot.
3. **Lots partis** — historique, chacun avec sa frise de livraison et son décompte d'appareils.

## Partie 2 — La frise de livraison

### Le problème

Le suivi actuel se résume à un badge à trois valeurs (`EN_COURS`, `LIVRE`, `INCONNU`). C'est
juste mais muet : on ne sait pas si le colis vient de partir ou s'il arrive demain.

`lib/domain/tracking/laposte.ts` refuse délibérément de déduire un état d'une table de codes
transporteur, jugée fragile. La frise ne la réintroduit pas : elle se déduit de champs
structurels que l'API La Poste renseigne quel que soit le transporteur.

### Les quatre étapes

| Étape | Déclencheur |
|---|---|
| 1. Expédié | numéro de suivi saisi |
| 2. Pris en charge | `shipment.entryDate` présent |
| 3. En transit | un événement postérieur à `entryDate`, et `isFinal` faux |
| 4. Livré | `isFinal` vrai et `deliveryDate` présent |

Une fonction pure `etapeColis(reponse: LaPosteTrackingResponse): 1 | 2 | 3 | 4` vit à côté
d'`etatDeShipment`, sans dépendance réseau ni Prisma, et se teste seule. Le cron l'appelle et
range le résultat dans `suiviEtape` (`ArticleStock` et `LotRetourOnt`). `suiviLibelle` et
`suiviLivreLe` restent inchangés et alimentent l'infobulle du dernier point atteint.

### Cas dégradés

Ils s'affichent au lieu d'être masqués :

- **Suivi introuvable** (404, `INCONNU`) : frise arrêtée à « Expédié », avec le message de
  retour de l'API sous la ligne.
- **DHL** : pas d'API de suivi. Frise figée à « Expédié », points suivants en pointillés, et
  le lien `urlSuiviTransporteur` à côté. Le composant ne prétend pas savoir.

### Composant

`components/FriseColis.tsx` : quatre points reliés par une ligne horizontale, icône au-dessus,
libellé en dessous. Points franchis en couleur pleine, à venir en pâle. Props : `etape`,
`libelle`, `livreLe`, `transporteur`, `numeroSuivi`, `indisponible`.

Il remplace le badge de statut à trois endroits : l'historique des colis du staging, la fiche
client, et la page des lots ONT.

Sous 640 px la frise passe en vertical — quatre libellés côte à côte ne tiennent pas sur un
téléphone. Les transitions respectent `prefers-reduced-motion`.

### Mise à jour automatique

Deux mécanismes distincts :

- **Cron `tracking-sync`** : de 2 h à 30 min, mais restreint aux colis non livrés
  (`suiviStatut != "LIVRE"`). Un colis livré n'est plus jamais interrogé, donc le volume de
  requêtes baisse malgré la fréquence.
- **Page** : rafraîchissement au retour d'onglet, puis toutes les 5 minutes tant que l'onglet
  est visible. En arrière-plan, aucune requête — le quota Prisma est une contrainte réelle
  (141 k opérations sur 1 M consommées en un gros mois).

## Tests

Logique pure, testée sans base :

- `etapeColis` : les quatre transitions, le 404, le colis sans événement, le colis livré sans
  `deliveryDate`.
- Règle de saisie de l'étape chef de projet : numéro seul, raison seule, les deux vides, numéro
  déjà attribué à un autre client.
- Constitution d'un lot : refus d'un ONT non reçu, refus d'un lot vide à la clôture, passage
  des articles à `ENVOYE`.

## Hors périmètre

- Import en masse d'ONT depuis un fichier : le flux est unitaire, un ONT par installation.
- Suivi API DHL : pas de compte, le lien public suffit.
- Retour d'un ONT vers un client : le flux est à sens unique, du client vers le grossiste.
