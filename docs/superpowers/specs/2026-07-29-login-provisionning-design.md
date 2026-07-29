# Login + Provisionning — design

Date: 2026-07-29

## Contexte

Le squelette déployé (Next.js, Prisma 7, Auth.js stub, sync Google Sheets) n'a aucune page
métier. SPEC.md §3 liste sept pages; trop large pour un seul spec. Ce document couvre le premier
sous-projet: la connexion (bloquante, rien n'est accessible sans) et la page Provisionning
(§3.1, "page principale"), avec le moteur de règles Contrôle N° (§5) qui alimente sa colonne
principale.

Hors scope, décidé explicitement:
- Coller depuis Excel (§3.1) — SPEC le marque "amélioration, pas un bloquant".
- Les six autres pages SPEC §3 (Clients, Téléphone, Import SDA/MAC, Lots, Import Monday,
  Paramètres) — sous-projets séparés.
- Page "Suivi client" (relances ADV, 3 appels max) — demandée par l'utilisateur pendant ce
  brainstorm, absente de SPEC.md, nécessite son propre spec une fois ce sous-projet livré.
- Écran de recalcul global du Contrôle N° — dépend de la page Paramètres, pas construite ici;
  un déclenchement direct (Server Action ou script) suffit pour ce sous-projet.

## Connexion

- Route `/login`, formulaire email/mot de passe, soumission via `signIn("credentials", {...})`
  (déjà câblé dans `auth.ts`, seule la page manquait).
- Redirection vers `/` après connexion réussie.
- Message d'erreur générique en cas d'échec (email inexistant et mauvais mot de passe produisent
  le même message — pas d'énumération).
- Middleware Next.js protège toutes les routes sauf `/login` et `/api/auth/*`.

## Seed

- `prisma/seed.ts` + script `bun run db:seed`.
- Un compte `UtilisateurApp` rôle ADMIN.
- `ListeValeur`: catégories `HEBERGEUR` (SEWAN, UNYC), `STATUT_BASCULE` (À faire, Fait), et les
  autres catégories déjà définies dans le schéma (`SCENARIO`, `TYPE_INTERVENTION`,
  `STATUT_MONDAY`, `TECHNO_LIEN`) avec au moins les valeurs déjà rencontrées dans SPEC.md.
- `ModeleEquipement`: catalogue avec `eligibleExport` selon SPEC §6.1 — Yealink vrai, Panasonic
  (TGP500, TGP600), Polycom (VVX400, IP5000, RealPresence Trio 8300), DOKO, FAX, Aastra faux.

## Contrôle N° (SPEC §5)

- `lib/domain/controle/controleNumero.ts` — fonction pure
  `evaluerControle(numero, contexteClient): { niveau: NiveauControle; detail: string | null }`.
- Cinq règles, dans l'ordre de sévérité (le niveau le plus sévère gagne, le détail liste toutes
  les anomalies trouvées, pas seulement la première):
  1. Après normalisation (espaces, points, tirets supprimés, `+33X` converti en `0X`): 10 chiffres,
     commence par 0. Sinon ERREUR.
  2. Préfixe 01-05 ou 09: plausible. 06, 07, 08: signalé sans bloquer — AVERTISSEMENT.
  3. Unicité globale du numéro normalisé sur les lots actifs (non clos). Doublon — ERREUR.
  4. Cohérence: utilisateur renseigné sans équipement, ou l'inverse — AVERTISSEMENT.
  5. Numéro court: unicité au sein du même client. Doublon — AVERTISSEMENT.
- `controleForce = true`: le recalcul ne touche pas `controleNiveau`/`controleDetail` existants,
  seulement vérifié/affiché comme forcé.
- Recalcul déclenché: à l'écriture (sauvegarde inline dans la grille) et via un déclenchement
  direct hors écran dédié (voir Hors scope).

## Page Provisionning

- Route `/` (remplace la page health-check actuelle), protégée par le middleware.
- TanStack Table + composants `Table`/`Tooltip`/`Select`/`AlertDialog` shadcn/ui.
- Colonnes exactes SPEC §3.1, dans l'ordre: Client (raison sociale), Numéro à porter, Numéro
  court, Contrôle N°, Equipement, Adresse MAC équipement, Utilisateur, Hébergeur source,
  Hébergeur cible, Bascule des numéros, Date bascule, Commentaires.
- Groupement visuel par client: tri par client, ligne d'en-tête de groupe insérée visuellement
  avec compteurs (nb numéros, nb MAC, nb bascules faites) — pas de vrai group-by TanStack, tri
  simple suffit pour ce sous-projet.
- Édition inline: cellule éditable au focus, sauvegarde sur `blur`/`Enter` via Server Action,
  mise à jour optimiste de l'état local, rollback + toast d'erreur si la Server Action échoue.
- Colonne Contrôle N°: lecture seule, badge coloré (OK vert, AVERTISSEMENT jaune, ERREUR rouge),
  détail au survol (`Tooltip`), action "forcer OK" (menu avec motif obligatoire, écrit
  `controleForce`/`controleMotif`/`controlePar`/`controleLe`).
- Filtres (barre au-dessus de la grille): lot, client, hébergeur, statut bascule, éligibilité
  export, présence d'anomalie (case à cocher).
- Recherche globale (numéro, MAC, utilisateur, raison sociale): champ avec debounce, filtre
  côté serveur pour rester scalable.
- Ajout de ligne: bouton avec menu (numéro seul / équipement seul / ligne complète), ouvre une
  ligne vide éditable directement dans la grille — pas de modale.

## Actions de masse

- Sélection multi-lignes via case à cocher par ligne.
- Barre d'actions visible dès une ligne sélectionnée: affecter un hébergeur cible, passer la
  bascule à Fait avec date (aujourd'hui par défaut, modifiable), exclure/réintégrer de l'export.
- Chaque action est une Server Action (transaction Prisma), confirmée par un `AlertDialog` avant
  exécution — pas d'annulation automatique, cohérent avec CLAUDE.md ("toute action de masse est
  réversible ou confirmée").

## Tests

- `lib/domain/controle/` pur, testé unitairement (`bun test`): les cinq règles et leurs cas
  limites (numéro déjà normalisé, doublon inter-lots, numéro court dupliqué, etc.).
- Le reste (page, Server Actions, middleware) vérifié en lançant l'application réellement — pas
  de tests unitaires pour la couche UI/orchestration dans ce sous-projet.
