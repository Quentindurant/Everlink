# Bascule Zoho Sheet → tableau de suivi maison (branche `feat/suivi-tableau-sync`)

Décision appliquée : **« Notre tableau seulement »** — Everlink ne lit ni n'écrit plus dans
le Zoho Sheet. Le tableau de suivi maison (repo `TableauSuivieGcDev`, API NestJS, prod
`https://suivie.appgcd.fr`) est l'unique cible et la source de vérité.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `lib/domain/suivi/ligneSuivi.ts` | Mapping pur Everlink ↔ 16 colonnes du tableau (push, pull, dispo), conversions de dates ISO ↔ FR, règle « champ vide n'écrase jamais » (`champsAMettreAJour`) |
| `lib/domain/suivi/ligneSuivi.test.ts` | Tests du mapping (16 clés, omission des vides, statut dérivé de l'étape, non-écrasement) |
| `lib/suivi/suiviClient.ts` | Client HTTP : login cookie httpOnly `token` + cache de session, re-login auto sur 401, `lireLignesMois` (cache 15 s), `creerLigne`, `patcherLigne` (retry unique sur 409) |
| `lib/suivi/suiviClient.test.ts` | Tests réseau sur faux fetch : login/session, 401→re-login, 409→retry, normalisation d'URL, cache |
| `lib/suivi/syncDepuisSuivi.ts` | `runSuiviPull` (remplace `runZohoPull`) : rapprochement par nom (réutilise `lib/domain/zoho/rapprochement` tel quel), création de techniciens plausibles |
| `lib/suivi/vueSuivi.ts` | Lectures résilientes : vue live (lignes EVERLINK du mois) et affectations pour la disponibilité (toutes lignes du mois) |
| `app/api/cron/suivi-pull/route.ts` | Nouvelle route cron canonique (POST, header `X-Cron-Secret`) |

## Fichiers modifiés

- `app/(app)/clients/[id]/zohoActions.ts` — le push écrit dans NOTRE tableau : `POST /api/rows {month}` puis `PATCH` des cellules. Mémorise aussi `zohoNomSheet` (nom poussé) pour un rapprochement immédiat au pull. Nom d'action conservé (`pousserVersZohoAction`) pour ne pas toucher l'UI.
- `app/(app)/techniciens/zohoViewActions.ts` — vue live et sync depuis le tableau (`lireVueSuivi`, `runSuiviPull`).
- `app/(app)/techniciens/ZohoLiveView.tsx` — imports de types + libellés (« Tableau de suivi », variables `SUIVI_API_*`). Logique inchangée.
- `lib/repositories/technicienRepository.ts` — disponibilité : `lireAffectationsSuivi` remplace `lireAffectationsSheet` (mêmes formats de dates FR, `nomsTechOccupes` réutilisé tel quel).
- `app/api/cron/zoho-pull/route.ts` — **alias historique** : ré-exporte le handler de `suivi-pull` pour ne pas casser la ligne cron déployée.
- `lib/zoho/zohoClient.ts`, `lib/zoho/syncDepuisSheet.ts` — dépréciés (commentaires `@deprecated`), non supprimés : `scripts/zoho-verifier.ts` reste un diagnostic legacy, et le client peut resservir côté Zoho CRM.
- `.env.example` — bloc `SUIVI_API_*` documenté, bloc `ZOHO_*` marqué déprécié.

## Mapping des 16 colonnes (push)

| Clé tableau | Source Everlink |
|---|---|
| `impe` | `dateImperative` (ISO `AAAA-MM-JJ`) |
| `client` | `prefixeSemaine(dateIntervention) + raisonSociale` (ex `S33 - ART PHOTO LAB`) |
| `dpt` | `departement` |
| `cp_client` | `extraireCodePostal(adresse)` |
| `partenaire` | `"EVERLINK"` (toujours) |
| `date` | `dateIntervention` (ISO) |
| `porta_commentaires` | `scenario — referenceClient` |
| `heure` | `creneauIntervention` |
| `tech` | nom du prestataire |
| `nom_tech` | nom du technicien |
| `nom_cp` | `contactPrenom contactNom` |
| `statut` | `statutSuivi` sinon `statutSheetPourEtape(étape)` |
| `commentaires_planif` | `commentaire` |
| `materiel_recu` | `materielRecu` |
| `num_chrono` | `numeroChrono` |
| `infos_facturation` | `infosFacturation` |

Champs vides omis (cellule laissée vide). Les colonnes DATE du tableau stockent l'ISO ;
les conversions ISO ↔ `JJ/MM/AAAA` se font aux frontières, si bien que `rapprochement.ts`
et `disponibilite.ts` sont réutilisés sans modification.

## Authentification et stratégie 409

- Le guard de l'API ne lit **que** le cookie httpOnly `token` (aucun Bearer, vérifié dans
  `apps/api/src/auth/jwt.guard.ts`). Le client rejoue donc le cookie de session
  (serveur → serveur), avec re-login automatique + une relance sur 401.
- `PATCH /api/rows/:id` : sur `409 VERSION_CONFLICT`, le corps porte `details.current`
  (la ligne relue). Le client retente **une seule fois** avec `current.version` (nos
  valeurs gagnent) ; sur un second 409 il abandonne proprement en remontant
  `conflictKeys` et un message en français.

## Cron

- Nouvelle URL canonique : `POST /api/cron/suivi-pull` (header `X-Cron-Secret`, inchangé).
- `POST /api/cron/zoho-pull` reste servie (alias, même handler) : la configuration cron
  serveur actuelle continue de fonctionner sans modification. À terme, la faire pointer
  sur `suivi-pull` puis supprimer l'alias.

## Reste à faire (côté utilisateur)

1. **Créer le compte de service Everlink** dans les Paramètres du tableau de suivi
   (aucun credential n'a été inventé ni committé).
2. **Renseigner sur le VPS** : `SUIVI_API_URL=https://suivie.appgcd.fr`,
   `SUIVI_API_EMAIL`, `SUIVI_API_PASSWORD` (puis redémarrer pm2).
3. Le cron serveur existant qui frappe `/api/cron/zoho-pull` continue de marcher ;
   le faire pointer vers `/api/cron/suivi-pull` quand pratique.
4. Optionnel : purger les variables `ZOHO_*` du VPS une fois la transition validée,
   puis supprimer `lib/zoho/zohoClient.ts`, `lib/zoho/syncDepuisSheet.ts` et
   `scripts/zoho-verifier.ts`.
5. Vocabulaire des statuts : le tableau connaît `EN COLLECTE` là où Everlink pousse
   `COLLECTE`, et `TECHNIQUE`/`OPER`/`PORTA`/`PV` n'existent pas dans les choix SELECT du
   tableau (l'API accepte la valeur, mais la pastille couleur ADV ne s'affichera pas).
   À harmoniser côté tableau (ajouter les choix) ou côté Everlink selon préférence ADV.

## Vérifications

- `bun test` : **166 pass, 7 skip, 0 fail** (baseline avant bascule : 138 pass, 7 skip —
  28 tests ajoutés, aucun cassé).
- `bun run build` (next build) : **vert**.
- Aucun usage restant de `lireLignesSheet` / `ajouterLigneSheet` / `runZohoPull` /
  `lireAffectationsSheet` dans `app/` et `lib/` (hors module Zoho déprécié lui-même) ;
  seul `scripts/zoho-verifier.ts` (diagnostic legacy, hors app) référence encore le Sheet.
