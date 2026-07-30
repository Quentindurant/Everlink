# Pages manquantes Everlink — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter les 6 pages manquantes de SPEC.md §3 (Clients, Téléphone, Import SDA, Import MAC, Lots, Import Monday, Paramètres) plus la navigation, sur la base du moteur domaine existant.

**Architecture:** Next.js App Router avec route group `(app)` portant un layout sidebar commun ; chaque page = Server Component qui lit via un repository `lib/repositories/*` + composants clients shadcn pour l'édition via server actions. Le domaine pur (parsing Monday, génération xlsx) vit dans `lib/domain/` avec tests bun.

**Tech Stack:** Next 15 App Router, Prisma 7 (adapter-pg), shadcn base-nova (components/ui existants), TanStack Table, exceljs (à installer) pour lecture/écriture xlsx, bun test.

## Global Constraints

- Rôles: ADMIN (paramètres, comptes, imports) / OPERATEUR (saisie, exports) — SPEC §10. Guard dans chaque action mutante concernée via `auth()`.
- Édition inline style Provisionning: `EditableCell` pattern existant (rollback + erreur 3 s).
- Une valeur `ListeValeur` utilisée ne peut être supprimée, seulement désactivée ; valeur désactivée encore référencée affichée "obsolète" — SPEC §8.
- Import Monday idempotent: champs Monday écrasés, champs saisis app jamais — SPEC §4.
- Export SDA: feuille `Feuil1`, filtre auto `A1:B1`, largeurs A=48 B=15, numéro format texte `@`, en-têtes non gras, nom `Import_SDA_-_<REF>.xlsx` — SPEC §6.2/6.4.
- Export MAC: feuille `Feuil1`, pas de filtre, largeurs A=48 B=22.71, MAC brute trim, nom `Import_MAC-_<REF>.xlsx` — SPEC §6.3/6.4.
- Chaque export téléchargé enregistre un `ExportBatch` (filtres, nbLignes, contenu) — SPEC §3.4.
- Français partout, style visuel = refonte Provisionning du 2026-07-30 (Geist, shadcn, badges).
- Déploiement final: `bunx @prisma/cli@latest app deploy --prod --yes`.

---

### Task 1: Navigation + route group

**Files:**
- Create: `app/(app)/layout.tsx` (layout avec sidebar, session via `auth()`, redirect géré par proxy)
- Create: `components/AppSidebar.tsx` (client component, liens actifs via `usePathname`)
- Move: `app/page.tsx` → `app/(app)/page.tsx` (inchangé)
- Modify: `app/layout.tsx` (rien à changer — vérifier)

**Interfaces:**
- Produces: sidebar avec entrées: Provisionning `/`, Clients `/clients`, Téléphone `/telephone`, Lots `/lots`, Import SDA `/import-sda`, Import MAC `/import-mac`, Import Monday `/import-monday`, Paramètres `/parametres` (visible ADMIN seulement), pied: email session + bouton déconnexion (`signOut` server action `app/(app)/actions.ts` → `logoutAction`).

- [ ] Créer sidebar + layout, déplacer page, vérifier `next build`
- [ ] Commit `feat(nav): app shell avec sidebar et route group`

### Task 2: Page Lots

**Files:**
- Create: `lib/repositories/lotsRepository.ts` — `fetchLots(): Promise<LotLigne[]>` avec `LotLigne = { id, nom, reference, clos, nbClients, nbNumeros, nbBasculesFaites }` (agrégats via `include: { clients: { include: { numeros } } }`), `creerLot(nom, reference)`, `updateLot(id, { nom?, reference?, clos? })`
- Create: `app/(app)/lots/page.tsx` + `app/(app)/lots/actions.ts` + `app/(app)/lots/LotsTable.tsx`

**Interfaces:**
- Produces: `fetchLots` réutilisé par la page Clients pour le filtre lot.

- [ ] Repository + page tableau (nom, référence, clients, avancement bascules en %, badge Clos) + création inline + édition référence
- [ ] Commit `feat(lots): page liste et gestion des lots`

### Task 3: Page Clients + fiche client

**Files:**
- Create: `lib/repositories/clientsRepository.ts` :
  - `fetchClientsListe(filtres: { lotId?, recherche? }): Promise<ClientListeLigne[]>` — id, raisonSociale, lotNom, groupe/filiale, nbNumeros, nbMacSaisis, nbMacDistincts, nbBasculesFaites, statutGlobal, scenario, adresse, contact, nbPostesAnnonce, ecartPostes (= nbPostesAnnonce − nb équipements) — SPEC §3.2 (les deux comptes MAC affichés, jamais le premier dans l'export)
  - `fetchClientDetail(id)` — client + numéros + équipements (avec modèle) + utilisateurs + suivis étapes + AuditLog (50 derniers) + mondayRaw
- Create: `app/(app)/clients/page.tsx`, `app/(app)/clients/ClientsTable.tsx`
- Create: `app/(app)/clients/[id]/page.tsx` — fiche avec onglets (Tabs shadcn à ajouter via composant maison si absent: simple state client) Numéros / Équipements / Utilisateurs / Suivi téléphonie / Monday / Historique

**Interfaces:**
- Consumes: `fetchLots` (Task 2) pour le filtre.
- Produces: liens `/clients/[id]` utilisés par Téléphone et previews exports.

- [ ] Repository liste + page tableau avec recherche/filtre lot, lien fiche
- [ ] Fiche détaillée onglets, chaque entité liée cliquable (interconnexion SPEC §9)
- [ ] Commit `feat(clients): liste et fiche client détaillée`

### Task 4: Page Téléphone

**Files:**
- Create: `lib/repositories/telephoneRepository.ts` — `fetchTelephoneGrille(filtres: { clientId?, recherche? })`: utilisateurs actifs avec client + map étapeId→statut, et liste étapes actives ordonnées ; `setSuiviEtape(utilisateurId, etapeId, statut)` (upsert, faitLe/faitPar si "Fait") ; `setEtapeClient(clientId, etapeId, statut)` (bulk tous utilisateurs du client)
- Create: `app/(app)/telephone/page.tsx`, `TelephoneGrille.tsx`, `actions.ts`

**Interfaces:**
- Consumes: `listValeursStatutEtape` — ajouter dans `provisionningRepository` un équivalent `listValeurs(categorie)` générique ou fonction locale lisant `ListeValeur` catégorie `STATUT_ETAPE`.
- Produces: pourcentage d'avancement par client réutilisé dans fiche client (Task 3 importe le même calcul: `nbFait / (nbUtilisateurs × nbEtapes)`).

- [ ] Grille groupée par client (pattern Provisionning): 1 ligne/utilisateur, 1 colonne/étape, select statut par cellule ; bande client avec % avancement + menu "toute l'étape → statut" (bulk)
- [ ] Commit `feat(telephone): grille suivi des étapes par utilisateur`

### Task 5: Previews + téléchargement Import SDA / Import MAC

**Files:**
- Modify: `package.json` — ajouter `exceljs`
- Create: `lib/domain/exports/xlsxWriter.ts` :
  ```ts
  export async function writeSdaXlsx(rows: string[][]): Promise<Buffer>
  export async function writeMacXlsx(rows: string[][]): Promise<Buffer>
  ```
  SDA: worksheet `Feuil1`, `columns = [{width:48},{width:15}]`, `autoFilter = "A1:B1"`, cellules colonne B `numFmt = "@"`, en-têtes non gras. MAC: largeurs 48 / 22.71, pas d'autoFilter.
- Create: `lib/domain/exports/xlsxWriter.test.ts` — relit le buffer via exceljs et vérifie nom feuille, largeurs, autoFilter présent/absent, numFmt.
- Modify: `lib/repositories/syncRepository.ts` — étendre `fetchSdaData`/`fetchMacData` avec paramètre optionnel `scope?: { lotId?: string; clientIds?: string[]; exclureBascules?: boolean }` (défaut: comportement actuel) ; ajouter `fetchSdaEcarts(scope)` / `fetchMacEcarts(scope)` retournant `{ raisonSociale, valeur, motif }[]` avec motifs: "modèle non éligible", "pas de numéro", "pas de MAC", "doublon", "exclusion manuelle", "client archivé" — SPEC §3.4.
- Create: `app/(app)/import-sda/page.tsx`, `app/(app)/import-mac/page.tsx` — nb lignes, répartition par client, tableau préview dans l'ordre exact du fichier, tableau des écartés avec motif, sélecteur de portée (lot / client / exclure basculés), bouton Télécharger.
- Create: `app/api/exports/sda/route.ts`, `app/api/exports/mac/route.ts` — GET avec query scope, génère buffer, enregistre `ExportBatch { type, lotId, filtres, nomFichier, nbLignes, contenu: rows }`, répond `Content-Disposition: attachment`.

**Interfaces:**
- Consumes: `buildSdaRows`, `buildMacRows`, `SDA_HEADERS`, `MAC_HEADERS` existants.
- Produces: `writeSdaXlsx(rows)` / `writeMacXlsx(rows)` où `rows` inclut la ligne d'en-tête.

- [ ] Tests writer xlsx (échouent), writer, tests verts
- [ ] Écarts + scope dans syncRepository
- [ ] Pages + routes téléchargement + ExportBatch
- [ ] Commit `feat(exports): préviews et téléchargement SDA/MAC conformes aux templates`

### Task 6: Import Monday

**Files:**
- Create: `lib/domain/import/monday.ts` :
  ```ts
  export interface MondayLigne { codeMonday: string|null; raisonSociale: string; lotNom: string|null; /* + tous champs SPEC §4 */ champsBruts: Record<string, unknown>; }
  export function parseMondayWorkbook(wb: ExcelJS.Workbook): { lignes: MondayLigne[]; erreurs: string[] }
  export interface RapprochementResultat { aCreer: MondayLigne[]; aMettreAJour: { ligne: MondayLigne; clientId: string }[]; aRapprocher: { ligne: MondayLigne; candidats: { id: string; raisonSociale: string }[] }[]; modelesInconnus: string[]; }
  export function rapprocher(lignes: MondayLigne[], existants: { id: string; codeMonday: string|null; raisonSociale: string }[], modelesConnus: string[]): RapprochementResultat
  ```
  Parsing: ligne 1 titre, ligne 2 groupe, ligne 3 en-têtes (47 col), séparateur de groupe = ligne à une seule cellule remplie, dernière ligne totaux (Name vide) ignorée, dates typées (pas de parse chaîne), rapprochement par codeMonday puis raisonSociale normalisée (majuscules, espaces réduits, accents conservés), aucun flou automatique.
- Create: `lib/domain/import/monday.test.ts` — workbook construit en mémoire: groupes multiples, ligne totaux, rapprochement exact/à trancher, idempotence du mapping.
- Create: `lib/repositories/importMondayRepository.ts` — `appliquerImport(resultat, decisions, auteurId)`: upsert clients (champs Monday seulement — ne jamais écraser hébergeurs/bascule/commentaire saisis), création `ModeleEquipement` inconnus (eligibleExport = marque Yealink), persiste `ImportRun { type: MONDAY, rapport: { crees, misAJour, ignores, aRapprocher, modelesInconnus, erreurs } }`.
- Create: `app/(app)/import-monday/page.tsx` + `ImportMondayForm.tsx` (upload → action `previsualiserAction` (FormData file) → affiche rapport + lignes à rapprocher avec select candidat/créer/ignorer → `validerAction`) + historique des `ImportRun`.

**Interfaces:**
- Consumes: `normaliserRaisonSociale` — réutiliser `lib/domain/normalisation.ts` si une fonction équivalente existe, sinon l'ajouter là.
- Produces: `ImportRun` listé aussi dans Paramètres.

- [ ] Tests parsing + rapprochement (échouent), implémentation, verts
- [ ] Repository application + page upload/préview/validation
- [ ] Commit `feat(import-monday): upload xlsx, rapprochement et rapport idempotent`

### Task 7: Page Paramètres (ADMIN)

**Files:**
- Create: `lib/repositories/parametresRepository.ts` — CRUD `ModeleEquipement` (toggle eligibleExport, alias, création), `ListeValeur` (ajout, réordonner, activer/désactiver ; suppression interdite si utilisée — vérifier usage par catégorie avant delete), `EtapeModele` (ajout, renommage, réordonnancement, désactivation), `UtilisateurApp` (création avec bcrypt, activer/désactiver, reset mot de passe), `recalculerControleGlobal()` (boucle `recalculerControle` sur numéros actifs), lecture `SheetSyncRun` récents.
- Create: `app/(app)/parametres/page.tsx` + sections client components + `actions.ts` (chaque action vérifie `session.user.role === "ADMIN"`)

**Interfaces:**
- Consumes: `recalculerControle(numeroId)` de provisionningRepository ; `runSheetsSync` pour déclenchement manuel.
- Produces: bandeau d'avertissement sync ("le Sheet est écrasé, sync sortante uniquement" — SPEC §7.2).

- [ ] Sections: Modèles (tableau + switch éligibilité + impact nb lignes export), Listes déroulantes (par catégorie), Étapes de suivi, Comptes, Synchronisation (bouton + historique + avertissement), Recalcul contrôle global
- [ ] Commit `feat(parametres): administration modèles, listes, étapes, comptes, sync`

### Task 8: Vérification et déploiement

- [ ] `npx tsc --noEmit` puis `bun test` puis `npx next build`
- [ ] Vérif visuelle Playwright (Postgres jetable, login, screenshot de chaque page)
- [ ] Commit final, push, `bunx @prisma/cli@latest app deploy --prod --yes`

## Self-Review

- SPEC §3.2→Task 3, §3.3→Task 4, §3.4→Task 5, §3.5→Task 2, §3.6→Task 6, §3.7→Task 7, §9 liens→Tasks 3-5, §10 rôles→Global. §7.1 (reprise initiale import Sheet) hors périmètre de ce plan: commande CLI dédiée, données de prod déjà migrées via sync — à traiter séparément si besoin.
- Types cohérents: `writeSdaXlsx(rows: string[][])` consommé par route SDA ; `fetchLots` consommé Tasks 2-3.
