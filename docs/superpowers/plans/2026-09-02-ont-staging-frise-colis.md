# Récupération des ONT et frise de livraison — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracer les ONT repris chez les clients jusqu'à leur retour au grossiste, et remplacer le badge de suivi colis à trois valeurs par une frise horizontale à quatre étapes.

**Architecture:** L'ONT n'est pas une entité neuve — c'est un `ArticleStock` de type `ONT` et d'origine `CLIENT`, créé par le chef de projet depuis sa checklist. Une table `LotRetourOnt` porte l'envoi groupé vers le grossiste et réutilise les mêmes noms de champs de suivi que `ArticleStock`, pour que le cron de tracking traite les deux sans cas particulier. La frise se déduit de champs structurels de l'API La Poste (`entryDate`, événements, `isFinal`, `deliveryDate`), jamais d'une table de codes transporteur.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL, Tailwind 4, shadcn/ui, bun pour les tests.

## Global Constraints

- Spec de référence : `docs/superpowers/specs/2026-09-02-ont-staging-frise-colis-design.md`.
- **Commentaires et messages d'interface en français.** Les commentaires expliquent *pourquoi*, jamais *quoi*.
- **Commits conventionnels en français**, terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Migrations strictement additives** (`CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `INSERT ... WHERE NOT EXISTS`). `scripts/deploy-migrate.sh` tolère un « already exists » mais fait échouer le déploiement sur toute autre erreur SQL. Aucun `DROP`, aucun `RENAME`.
- Les migrations s'appliquent **dans l'ordre alphabétique du nom de dossier**. Une migration qui utilise une colonne doit être datée après celle qui la crée.
- **Tests :** `bun test`. Vérifier le compte avec `bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"` — un `tail` masque les échecs.
- **Typecheck :** `npx tsc --noEmit`, qui doit sortir vide.
- Aucun test de composant React n'existe dans le dépôt. La logique pure est testée par `bun test` ; le rendu se vérifie à l'écran.
- **Quota Prisma** : 141 k opérations consommées sur 1 M en un gros mois. Toute boucle ou tout rafraîchissement automatique doit être justifié par son coût.
- Les statuts d'étape valides de `SuiviProjet` sont exactement `À faire`, `En cours`, `Fait`, `Aucun`.
- Ne jamais afficher ni committer le contenu de `.env`.

---

## Structure des fichiers

**Créés :**

| Fichier | Responsabilité |
|---|---|
| `components/FriseColis.tsx` | La frise horizontale à quatre points. Aucune logique métier. |
| `components/useRafraichissementAuto.ts` | Hook de rafraîchissement au retour d'onglet et par intervalle. |
| `lib/domain/staging/ont.ts` | Règles pures : validité d'une saisie d'ONT, d'une entrée en lot, d'une clôture de lot. |
| `lib/domain/staging/ont.test.ts` | Tests de ces règles. |
| `lib/repositories/ontRepository.ts` | Accès base : ONT annoncés, lot ouvert, lots partis, écritures. |
| `app/(app)/staging/ont/page.tsx` | Page staging à trois zones. |
| `app/(app)/staging/ont/OntStaging.tsx` | Composant client de la page ONT. |
| `prisma/migrations/20260902090000_ont_retour_et_frise/migration.sql` | Colonnes de suivi, `lotRetourId`, table `LotRetourOnt`. |
| `prisma/migrations/20260902091000_etape_recuperer_ont/migration.sql` | L'étape « Récupérer l'ONT ». |

**Modifiés :**

| Fichier | Changement |
|---|---|
| `lib/domain/tracking/laposte.ts` | `EtapeColis`, `etapeColis()`, `LIBELLES_ETAPE_COLIS` ; `EtatSuivi` gagne `etape`. |
| `lib/domain/tracking/laposte.test.ts` | Tests de `etapeColis`. |
| `lib/tracking/runTrackingSync.ts` | Écrit `suiviEtape` ; couvre `LotRetourOnt`. |
| `prisma/schema.prisma` | Reflet des deux migrations. |
| `scripts/install-crons.sh` | `tracking-sync` passe à 30 min. |
| `app/(app)/staging/HistoriqueColis.tsx` | La frise remplace le badge. |
| `app/(app)/clients/[id]/page.tsx` | Idem sur la fiche client. |
| `app/(app)/staging/page.tsx` | Tuile « ONT ». |
| `app/(app)/chef-projet/ChecklistProjet.tsx` | Saisie spéciale de l'étape ONT. |
| `app/(app)/chef-projet/actions.ts` | Action d'enregistrement de l'ONT. |
| `lib/repositories/stockRepository.ts` | `ColisExpedie` porte `suiviEtape`. |

---

### Task 1 : `etapeColis`, la frise déduite de l'API

**Files:**
- Modify: `lib/domain/tracking/laposte.ts`
- Test: `lib/domain/tracking/laposte.test.ts`

**Interfaces:**
- Consumes: `LaPosteTrackingResponse`, `Shipment`, `EtatSuivi`, `etatDeShipment` — déjà dans le fichier.
- Produces: `type EtapeColis = 1 | 2 | 3 | 4` ; `etapeColis(reponse: LaPosteTrackingResponse): EtapeColis` ; `LIBELLES_ETAPE_COLIS: Record<EtapeColis, string>` ; `EtatSuivi` gagne le champ `etape: EtapeColis`.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `lib/domain/tracking/laposte.test.ts` :

```ts
import { etapeColis, LIBELLES_ETAPE_COLIS } from "./laposte";

describe("etapeColis", () => {
  const rep = (shipment: unknown) =>
    ({ returnCode: 200, shipment } as Parameters<typeof etapeColis>[0]);

  test("suivi introuvable : on sait seulement que le colis est parti", () => {
    expect(etapeColis({ returnCode: 404 })).toBe(1);
    expect(etapeColis({ returnCode: 200 })).toBe(1);
  });

  test("colis connu mais sans prise en charge ni événement", () => {
    expect(etapeColis(rep({ idShip: "X", holder: 3, product: "chrono", isFinal: false }))).toBe(1);
  });

  test("entryDate seule : pris en charge", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("un événement postérieur à la prise en charge : en transit", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-02T06:30:00+02:00", label: "En cours d'acheminement", code: "AG1" }],
    });
    expect(etapeColis(r)).toBe(3);
  });

  test("l'événement de prise en charge lui-même ne fait pas un transit", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-01T08:00:00+02:00", label: "Pris en charge", code: "PC1" }],
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("livré : isFinal et deliveryDate ensemble", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: true,
      entryDate: "2026-09-01T08:00:00+02:00",
      deliveryDate: "2026-09-03T10:12:00+02:00",
      event: [{ date: "2026-09-03T10:12:00+02:00", label: "Votre colis est livré", code: "DI1" }],
    });
    expect(etapeColis(r)).toBe(4);
  });

  test("isFinal sans date de livraison ne vaut pas livraison", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: true,
      entryDate: "2026-09-01T08:00:00+02:00",
      event: [{ date: "2026-09-02T09:00:00+02:00", label: "Retour expéditeur", code: "RE1" }],
    });
    expect(etapeColis(r)).toBe(3);
  });

  test("des événements sans entryDate valent prise en charge", () => {
    const r = rep({
      idShip: "X", holder: 3, product: "chrono", isFinal: false,
      event: [{ date: "2026-09-02T09:00:00+02:00", label: "Traitement", code: "TR1" }],
    });
    expect(etapeColis(r)).toBe(2);
  });

  test("les quatre étapes ont un libellé", () => {
    expect(Object.keys(LIBELLES_ETAPE_COLIS)).toHaveLength(4);
    expect(LIBELLES_ETAPE_COLIS[4]).toBe("Livré");
  });
});

describe("etatDeShipment porte l'étape", () => {
  test("un colis livré rapporte l'étape 4", () => {
    const etat = etatDeShipment({
      returnCode: 200,
      shipment: {
        idShip: "X", holder: 3, product: "chrono", isFinal: true,
        entryDate: "2026-09-01T08:00:00+02:00",
        deliveryDate: "2026-09-03T10:12:00+02:00",
        event: [{ date: "2026-09-03T10:12:00+02:00", label: "Livré", code: "DI1" }],
      },
    });
    expect(etat.etape).toBe(4);
  });

  test("un suivi introuvable rapporte l'étape 1", () => {
    expect(etatDeShipment({ returnCode: 404 }).etape).toBe(1);
  });
});
```

Si `etatDeShipment` n'est pas déjà importé en haut du fichier de test, l'ajouter à l'import existant plutôt que d'en créer un second.

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `bun test lib/domain/tracking/laposte.test.ts 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: échec sur `etapeColis is not a function` / propriété `etape` absente.

- [ ] **Step 3 : Implémenter**

Dans `lib/domain/tracking/laposte.ts`, ajouter avant `etatDeShipment` :

```ts
// Avancement affichable d'un colis, en quatre points. Volontairement déduit de champs
// structurels (entryDate, événements, isFinal, deliveryDate) et non d'une table de codes
// transporteur : les codes varient d'un transporteur à l'autre, ces quatre champs non.
export type EtapeColis = 1 | 2 | 3 | 4;

export const LIBELLES_ETAPE_COLIS: Record<EtapeColis, string> = {
  1: "Expédié",
  2: "Pris en charge",
  3: "En transit",
  4: "Livré",
};

export function etapeColis(reponse: LaPosteTrackingResponse): EtapeColis {
  // Suivi introuvable : le colis est parti, c'est tout ce qu'on sait honnêtement.
  if (reponse.returnCode === 404 || !reponse.shipment) return 1;

  const s = reponse.shipment;
  if (s.isFinal === true && s.deliveryDate) return 4;

  const evenements = s.event ?? [];
  const priseEnCharge = s.entryDate ? Date.parse(s.entryDate) : Number.NaN;
  const posterieur = evenements.some((e) => {
    const t = Date.parse(e.date);
    return Number.isFinite(t) && Number.isFinite(priseEnCharge) && t > priseEnCharge;
  });
  if (posterieur) return 3;

  // Des événements sans entryDate : le colis circule, on ne sait pas depuis quand.
  if (s.entryDate || evenements.length > 0) return 2;
  return 1;
}
```

Puis étendre `EtatSuivi` :

```ts
export interface EtatSuivi {
  statut: SuiviStatut;
  // Dernier événement lisible ("Votre colis est livré", "Pris en charge par Chronopost"…).
  libelle: string | null;
  // Date de livraison ISO si le colis est arrivé.
  livreLe: string | null;
  // Position sur la frise à quatre points.
  etape: EtapeColis;
}
```

Et renseigner `etape` dans les deux `return` d'`etatDeShipment` :

```ts
  if (reponse.returnCode === 404 || !reponse.shipment) {
    return {
      statut: "INCONNU",
      libelle: reponse.returnMessage ?? null,
      livreLe: null,
      etape: etapeColis(reponse),
    };
  }
  const s = reponse.shipment;
  const dernier = s.event && s.event.length > 0 ? s.event[0] : null;
  const libelle = dernier?.label ?? null;
  const livre = s.isFinal === true && !!s.deliveryDate;
  return {
    statut: livre ? "LIVRE" : "EN_COURS",
    libelle,
    livreLe: livre ? (s.deliveryDate as string) : null,
    etape: etapeColis(reponse),
  };
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun test lib/domain/tracking/ 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: `0 fail`.

- [ ] **Step 5 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Si un appelant construit un `EtatSuivi` littéral, il manque désormais `etape` — le corriger.

- [ ] **Step 6 : Commit**

```bash
git add lib/domain/tracking/laposte.ts lib/domain/tracking/laposte.test.ts
git commit -m "$(cat <<'EOF'
feat(suivi): déduit l'avancement d'un colis en quatre étapes

Le badge à trois valeurs ne dit pas si le colis vient de partir ou s'il
arrive demain. etapeColis situe l'envoi sur une frise, à partir des champs
structurels de l'API (entryDate, événements, isFinal, deliveryDate) et non
d'une table de codes transporteur, qui varie d'un transporteur à l'autre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 : Migration — colonnes de suivi, lot de retour

**Files:**
- Create: `prisma/migrations/20260902090000_ont_retour_et_frise/migration.sql`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: rien.
- Produces: `ArticleStock.suiviEtape: Int?`, `ArticleStock.lotRetourId: String?`, `Client.colisSuiviEtape: Int?`, modèle `LotRetourOnt` avec `id, destinataire, transporteur, numeroSuivi, expedieLe, suiviStatut, suiviLibelle, suiviEtape, suiviLivreLe, suiviMajLe, articles, creeLe, majLe`.

- [ ] **Step 1 : Écrire la migration SQL**

Créer `prisma/migrations/20260902090000_ont_retour_et_frise/migration.sql` :

```sql
-- Avancement du colis sur la frise à quatre points (1 Expédié … 4 Livré). Nullable :
-- un colis jamais interrogé n'a pas d'étape, et la frise le montre tel quel.
ALTER TABLE "ArticleStock" ADD COLUMN IF NOT EXISTS "suiviEtape" INTEGER;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "colisSuiviEtape" INTEGER;

-- Envoi groupé des ONT récupérés chez les clients vers le grossiste. Les champs de suivi
-- portent les mêmes noms que ceux d'ArticleStock : le cron de tracking traite les deux
-- tables avec le même code, sans cas particulier.
CREATE TABLE IF NOT EXISTS "LotRetourOnt" (
  "id"           TEXT PRIMARY KEY,
  "destinataire" TEXT NOT NULL,
  "transporteur" TEXT,
  "numeroSuivi"  TEXT,
  "expedieLe"    TIMESTAMP(3),
  "suiviStatut"  TEXT,
  "suiviLibelle" TEXT,
  "suiviEtape"   INTEGER,
  "suiviLivreLe" TIMESTAMP(3),
  "suiviMajLe"   TIMESTAMP(3),
  "creeLe"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "majLe"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LotRetourOnt_numeroSuivi_idx" ON "LotRetourOnt" ("numeroSuivi");
CREATE INDEX IF NOT EXISTS "LotRetourOnt_expedieLe_idx" ON "LotRetourOnt" ("expedieLe");

-- Rattachement de l'ONT à son lot de retour. ON DELETE SET NULL : supprimer un lot ne doit
-- jamais faire disparaître la trace des appareils qu'il contenait.
ALTER TABLE "ArticleStock" ADD COLUMN IF NOT EXISTS "lotRetourId" TEXT;
CREATE INDEX IF NOT EXISTS "ArticleStock_lotRetourId_idx" ON "ArticleStock" ("lotRetourId");

DO $$
BEGIN
  ALTER TABLE "ArticleStock"
    ADD CONSTRAINT "ArticleStock_lotRetourId_fkey"
    FOREIGN KEY ("lotRetourId") REFERENCES "LotRetourOnt"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2 : Refléter dans le schéma Prisma**

Dans `prisma/schema.prisma`, ajouter à `ArticleStock`, sous le bloc de commentaire « Expédition du colis » :

```prisma
  suiviEtape   Int?
```

et, après `commentaire String?` :

```prisma
  // Lot de retour vers le grossiste (ONT récupérés chez les clients).
  lotRetour   LotRetourOnt? @relation(fields: [lotRetourId], references: [id], onDelete: SetNull)
  lotRetourId String?
```

Ajouter `@@index([lotRetourId])` au bloc d'index d'`ArticleStock`.

Dans `Client`, après `colisSuiviMajLe DateTime?` :

```prisma
  colisSuiviEtape   Int?
```

Et le nouveau modèle, à placer juste après `ArticleStock` :

```prisma
// Envoi groupé des ONT récupérés chez les clients vers le grossiste. Un lot sans expedieLe
// est le panier en préparation du staging ; il n'y en a qu'un ouvert à la fois.
model LotRetourOnt {
  id           String    @id @default(cuid())
  destinataire String
  transporteur String?
  numeroSuivi  String?
  expedieLe    DateTime?

  // Mêmes noms que ArticleStock : le cron de tracking traite les deux sans cas particulier.
  suiviStatut  String?
  suiviLibelle String?
  suiviEtape   Int?
  suiviLivreLe DateTime?
  suiviMajLe   DateTime?

  articles ArticleStock[]

  creeLe DateTime @default(now())
  majLe  DateTime @updatedAt

  @@index([numeroSuivi])
  @@index([expedieLe])
}
```

- [ ] **Step 3 : Régénérer le client Prisma et vérifier**

Run: `npx prisma generate && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 4 : Vérifier que la migration passe sur une base jetable**

Run:
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /dev/null && echo "schéma cohérent"
```
Expected: `schéma cohérent`. (Le déploiement réel applique le SQL via `scripts/deploy-migrate.sh`.)

- [ ] **Step 5 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 6 : Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260902090000_ont_retour_et_frise
git commit -m "$(cat <<'EOF'
feat(bdd): table de lot de retour ONT et étape de frise

Les ONT repris chez les clients repartent au grossiste par lots. LotRetourOnt
porte le colis, ArticleStock.lotRetourId l'appartenance. La clé étrangère est
en SET NULL : supprimer un lot ne doit pas effacer la trace des appareils.

suiviEtape stocke la position sur la frise, sur ArticleStock, Client et le lot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 : Le cron enregistre l'étape et suit les lots

**Files:**
- Modify: `lib/tracking/runTrackingSync.ts`
- Modify: `scripts/install-crons.sh`

**Interfaces:**
- Consumes: `etatDeShipment` via `suivreColis` (renvoie désormais `etape`), modèle `LotRetourOnt`.
- Produces: `TrackingSyncResult` gagne `lotsVerifies: number`.

- [ ] **Step 1 : Écrire l'étape dans les deux boucles existantes**

Dans `lib/tracking/runTrackingSync.ts`, ajouter `suiviEtape: etat.etape,` au `data` de `prisma.articleStock.update`, et `colisSuiviEtape: etat.etape,` à celui de `prisma.client.update`.

- [ ] **Step 2 : Ajouter la boucle des lots**

Étendre l'interface :

```ts
export interface TrackingSyncResult {
  succes: boolean;
  configure: boolean;
  articlesVerifies: number;
  clientsVerifies: number;
  lotsVerifies: number;
  misAJour: number;
  message?: string;
}
```

Renseigner `lotsVerifies: 0` dans le retour anticipé « API_KEY_LAPOSTE absente ».

Ajouter le lot au `Promise.all` de lecture :

```ts
    prisma.lotRetourOnt.findMany({
      where: {
        numeroSuivi: { not: null },
        NOT: { suiviStatut: "LIVRE" },
      },
      select: { id: true, numeroSuivi: true, transporteur: true },
    }),
```

en destructurant `const [articles, clients, lots] = await Promise.all([...]);`.

Puis, après la boucle des clients :

```ts
  for (const l of lots) {
    // DHL et autres transporteurs hors API La Poste : pas de relevé automatique.
    if (!transporteurAvecSuiviApi(l.transporteur)) continue;
    const etat = await suivreColis(l.numeroSuivi as string);
    if (!etat) continue;
    await prisma.lotRetourOnt.update({
      where: { id: l.id },
      data: {
        suiviStatut: etat.statut,
        suiviLibelle: etat.libelle,
        suiviEtape: etat.etape,
        suiviLivreLe: etat.livreLe ? new Date(etat.livreLe) : null,
        suiviMajLe: new Date(),
      },
    });
    misAJour++;
  }
```

Et `lotsVerifies: lots.length,` dans le retour final.

- [ ] **Step 3 : Passer le cron à 30 minutes**

Dans `scripts/install-crons.sh`, remplacer la planification de `tracking-sync` par `*/30 * * * *`, et mettre à jour le message final `echo` pour ne plus annoncer « toutes les 2h » pour ce cron.

Ajouter au-dessus de la ligne, en commentaire shell :

```sh
# tracking-sync toutes les 30 min : la requête ne porte que sur les colis non livrés, donc le
# volume décroît à mesure qu'ils arrivent. Un colis livré n'est plus jamais interrogé.
```

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit && bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: aucune sortie du typecheck, `0 fail`.

- [ ] **Step 5 : Vérifier la syntaxe du script cron**

Run: `bash -n scripts/install-crons.sh && echo "syntaxe correcte"`
Expected: `syntaxe correcte`.

- [ ] **Step 6 : Commit**

```bash
git add lib/tracking/runTrackingSync.ts scripts/install-crons.sh
git commit -m "$(cat <<'EOF'
feat(suivi): enregistre l'étape de frise et suit les lots de retour

Le cron relève désormais l'étape en plus du statut, et couvre les lots ONT au
même titre que les articles et les dossiers.

Passage à 30 minutes : la requête ne porte que sur les colis non livrés, donc
le volume baisse à mesure qu'ils arrivent malgré la fréquence.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 : Le composant `FriseColis`

**Files:**
- Create: `components/FriseColis.tsx`

**Interfaces:**
- Consumes: `LIBELLES_ETAPE_COLIS`, `EtapeColis`, `transporteurAvecSuiviApi`, `urlSuiviTransporteur` depuis `@/lib/domain/tracking/laposte`.
- Produces: `FriseColis({ etape, libelle, livreLe, transporteur, numeroSuivi })`, où `etape: number | null`.

- [ ] **Step 1 : Écrire le composant**

Créer `components/FriseColis.tsx` :

```tsx
import { Package, Truck, Warehouse, MapPin } from "lucide-react";
import {
  LIBELLES_ETAPE_COLIS,
  transporteurAvecSuiviApi,
  urlSuiviTransporteur,
  type EtapeColis,
} from "@/lib/domain/tracking/laposte";

const ICONES: Record<EtapeColis, React.ComponentType<{ className?: string }>> = {
  1: Package,
  2: Warehouse,
  3: Truck,
  4: MapPin,
};

const ETAPES: EtapeColis[] = [1, 2, 3, 4];

// Frise horizontale d'avancement d'un colis. Les points franchis sont pleins, les suivants
// pâles. Sous 640 px elle bascule en vertical : quatre libellés côte à côte ne tiennent pas
// sur un téléphone.
//
// Le composant ne devine rien : `etape` lui est fournie, et les deux cas dégradés (suivi
// introuvable, transporteur sans API) s'affichent au lieu d'être maquillés en progression.
export function FriseColis({
  etape,
  libelle,
  livreLe,
  transporteur,
  numeroSuivi,
}: {
  etape: number | null;
  libelle: string | null;
  livreLe: string | null;
  transporteur: string | null;
  numeroSuivi: string | null;
}) {
  if (!numeroSuivi) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const suiviApi = transporteurAvecSuiviApi(transporteur);
  const urlExterne = urlSuiviTransporteur(transporteur, numeroSuivi);
  // Sans relevé automatique, on n'affirme rien au-delà de « parti ».
  const atteinte = suiviApi ? Math.min(Math.max(etape ?? 1, 1), 4) : 1;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
        {ETAPES.map((e) => {
          const Icone = ICONES[e];
          const franchie = e <= atteinte;
          const courante = e === atteinte;
          const incertaine = !suiviApi && e > 1;
          return (
            <li key={e} className="flex items-start gap-3 sm:flex-1 sm:flex-col sm:gap-1.5">
              <div className="flex items-center sm:w-full">
                {/* Trait gauche : absent sur le premier point. */}
                <span
                  aria-hidden
                  className="hidden h-1 flex-1 rounded-full sm:block"
                  style={{
                    background: e === 1 ? "transparent" : trait(franchie),
                  }}
                />
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full transition-colors motion-reduce:transition-none"
                  style={{
                    background: franchie ? "var(--pal-green-bg)" : "var(--ev-surface-muted)",
                    color: franchie ? "var(--pal-green-fg)" : "var(--ev-text-tertiary)",
                    outline: courante ? "2px solid var(--pal-green-dot)" : "none",
                    outlineOffset: 2,
                  }}
                  title={courante ? (libelle ?? LIBELLES_ETAPE_COLIS[e]) : LIBELLES_ETAPE_COLIS[e]}
                >
                  <Icone className="size-4" />
                </span>
                <span
                  aria-hidden
                  className="hidden h-1 flex-1 rounded-full sm:block"
                  style={{
                    background: e === 4 ? "transparent" : trait(e < atteinte),
                    ...(incertaine ? { opacity: 0.4 } : null),
                  }}
                />
              </div>
              <span
                className="text-[11px] sm:text-center"
                style={{
                  color: franchie ? "var(--ev-body)" : "var(--ev-text-tertiary)",
                  fontWeight: courante ? 700 : 500,
                }}
              >
                {LIBELLES_ETAPE_COLIS[e]}
                {e === 4 && livreLe ? (
                  <span className="block font-normal text-[10px] text-muted-foreground">
                    {new Date(livreLe).toLocaleDateString("fr-FR")}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
        <span className="font-mono" style={{ color: "var(--ev-text-tertiary)" }}>
          {transporteur ? `${transporteur} · ` : ""}
          {numeroSuivi}
        </span>
        {urlExterne ? (
          <a
            href={urlExterne}
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: "var(--ev-text-tertiary)" }}
          >
            Suivre sur le site {transporteur}
          </a>
        ) : null}
        {!suiviApi ? (
          <span style={{ color: "var(--ev-text-tertiary)" }}>
            Pas de suivi automatique pour ce transporteur
          </span>
        ) : null}
        {suiviApi && etape === null ? (
          <span style={{ color: "var(--ev-text-tertiary)" }}>Suivi pas encore relevé</span>
        ) : null}
      </div>
    </div>
  );
}

function trait(franchi: boolean): string {
  return franchi ? "var(--pal-green-dot)" : "var(--ev-surface-muted)";
}
```

- [ ] **Step 2 : Vérifier que les variables CSS existent**

Run: `grep -nE "\-\-ev-surface-muted|\-\-ev-text-tertiary|\-\-pal-green-dot|\-\-pal-green-bg|\-\-pal-green-fg|\-\-ev-body" app/globals.css | head`
Expected: chaque variable apparaît. Si l'une manque, la remplacer par l'équivalent réellement défini dans `app/globals.css` — ne pas en inventer.

- [ ] **Step 3 : Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 4 : Commit**

```bash
git add components/FriseColis.tsx
git commit -m "$(cat <<'EOF'
feat(ui): frise horizontale d'avancement d'un colis

Quatre points reliés, icône au-dessus, libellé en dessous. Vertical sous
640 px, où quatre libellés côte à côte ne tiennent pas.

Les cas dégradés s'affichent au lieu d'être maquillés : un transporteur sans
API reste bloqué à « Expédié » avec son lien externe, un suivi jamais relevé
le dit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5 : Brancher la frise à la place du badge

**Files:**
- Modify: `lib/repositories/stockRepository.ts:136-176`
- Modify: `app/(app)/staging/HistoriqueColis.tsx`
- Modify: `app/(app)/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: `FriseColis` (Task 4), `ColisExpedie` (existant).
- Produces: `ColisExpedie` gagne `suiviEtape: number | null` et `suiviLivreLe: string | null`.

- [ ] **Step 1 : Remonter l'étape depuis le dépôt**

Dans `lib/repositories/stockRepository.ts`, ajouter à l'interface `ColisExpedie` :

```ts
  suiviEtape: number | null;
  suiviLivreLe: string | null;
```

et, dans `fetchHistoriqueColis`, au `parCle.set(...)` :

```ts
        suiviEtape: a.suiviEtape,
        suiviLivreLe: jour(a.suiviLivreLe),
```

- [ ] **Step 2 : Remplacer le badge dans l'historique**

Dans `app/(app)/staging/HistoriqueColis.tsx`, remplacer l'usage de `SuiviColisBadge` par :

```tsx
<FriseColis
  etape={colis.suiviEtape}
  libelle={colis.suiviLibelle}
  livreLe={colis.suiviLivreLe}
  transporteur={colis.transporteur}
  numeroSuivi={colis.numeroSuivi}
/>
```

et l'import correspondant. Retirer l'import de `SuiviColisBadge` s'il devient inutilisé dans ce fichier.

- [ ] **Step 3 : Remplacer le badge sur la fiche client**

Dans `app/(app)/clients/[id]/page.tsx`, localiser l'usage de `SuiviColisBadge` (`grep -n "SuiviColisBadge" "app/(app)/clients/[id]/page.tsx"`) et le remplacer par :

```tsx
<FriseColis
  etape={client.colisSuiviEtape}
  libelle={client.colisSuiviLibelle}
  livreLe={client.colisSuiviLivreLe ? client.colisSuiviLivreLe.toISOString() : null}
  transporteur={client.colisTransporteur}
  numeroSuivi={client.colisNumeroSuivi}
/>
```

Adapter les noms d'accès à la variable réellement en portée dans ce fichier (`client`, `dossier`…) et, si la requête Prisma de la page a un `select` explicite, y ajouter `colisSuiviEtape: true`.

`components/SuiviColisBadge.tsx` **n'est pas supprimé** : il reste utilisé dans les listes denses (`StockCrud`, accueil) où une frise ne tient pas.

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit && grep -rn "SuiviColisBadge" app components | grep -v "components/SuiviColisBadge.tsx"`
Expected: typecheck vide ; les usages restants sont uniquement ceux des listes denses.

- [ ] **Step 5 : Vérifier à l'écran**

Lancer l'application, ouvrir `/staging/suivi` et une fiche client ayant un numéro de suivi. La frise s'affiche, le point courant est cerclé, le numéro reste lisible sous la ligne. Réduire la fenêtre sous 640 px : la frise passe en vertical.

- [ ] **Step 6 : Commit**

```bash
git add lib/repositories/stockRepository.ts "app/(app)/staging/HistoriqueColis.tsx" "app/(app)/clients/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(staging): la frise remplace le badge sur l'historique et la fiche client

Le badge reste dans les listes denses, où une frise ne tiendrait pas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6 : Rafraîchissement automatique des pages de suivi

**Files:**
- Create: `components/useRafraichissementAuto.ts`
- Modify: `app/(app)/staging/HistoriqueColis.tsx`

**Interfaces:**
- Consumes: `useRouter` de `next/navigation`.
- Produces: `useRafraichissementAuto(intervalleMs?: number): void` — défaut 300 000 ms.

- [ ] **Step 1 : Écrire le hook**

Créer `components/useRafraichissementAuto.ts` :

```ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit les données serveur de la page sans rechargement : au retour sur l'onglet, puis
// par intervalle tant que l'onglet est visible. En arrière-plan, aucune requête — le quota
// Prisma est une contrainte réelle, et une page ouverte toute la journée ne doit pas la
// consommer pour rien.
export function useRafraichissementAuto(intervalleMs = 300_000) {
  const router = useRouter();

  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const minuteur = setInterval(rafraichir, intervalleMs);
    document.addEventListener("visibilitychange", rafraichir);
    window.addEventListener("focus", rafraichir);

    return () => {
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", rafraichir);
      window.removeEventListener("focus", rafraichir);
    };
  }, [router, intervalleMs]);
}
```

- [ ] **Step 2 : L'utiliser sur l'historique des colis**

Dans `app/(app)/staging/HistoriqueColis.tsx` (composant client), appeler `useRafraichissementAuto();` en première ligne du corps du composant, avec l'import `import { useRafraichissementAuto } from "@/components/useRafraichissementAuto";`.

Si le fichier n'a pas de directive `"use client"`, l'ajouter en première ligne.

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 4 : Vérifier le comportement**

Ouvrir `/staging/suivi`, passer sur un autre onglet, revenir : la page se rafraîchit sans clignoter. Laisser l'onglet en arrière-plan cinq minutes et vérifier dans l'onglet Réseau qu'aucune requête ne part pendant ce temps.

- [ ] **Step 5 : Commit**

```bash
git add components/useRafraichissementAuto.ts "app/(app)/staging/HistoriqueColis.tsx"
git commit -m "$(cat <<'EOF'
feat(staging): rafraîchit le suivi des colis sans rechargement

Au retour d'onglet, puis toutes les cinq minutes tant que l'onglet est
visible. En arrière-plan, aucune requête : une page laissée ouverte toute la
journée ne doit pas consommer le quota Prisma pour rien.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7 : Règles métier des ONT (logique pure)

**Files:**
- Create: `lib/domain/staging/ont.ts`
- Test: `lib/domain/staging/ont.test.ts`

**Interfaces:**
- Consumes: `numeroSuiviValidePour` depuis `@/lib/domain/tracking/laposte`.
- Produces :
  - `type SaisieOnt = { numeroSerie: string; raison: string }`
  - `type ResultatSaisie = { ok: true; mode: "numero"; numeroSerie: string } | { ok: true; mode: "absence"; raison: string } | { ok: false; message: string }`
  - `valideSaisieOnt(saisie: SaisieOnt, numerosExistants: Map<string, string>): ResultatSaisie`
  - `peutEntrerDansLot(article: { dateReception: Date | null; lotRetourId: string | null }): boolean`
  - `valideClotureLot(lot: { nbArticles: number; destinataire: string; transporteur: string; numeroSuivi: string }): { ok: true } | { ok: false; message: string }`
  - `normaliserNumeroSerie(brut: string): string`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `lib/domain/staging/ont.test.ts` :

```ts
import { describe, expect, test } from "bun:test";
import {
  normaliserNumeroSerie,
  peutEntrerDansLot,
  valideClotureLot,
  valideSaisieOnt,
} from "./ont";

const aucun = new Map<string, string>();

describe("valideSaisieOnt", () => {
  test("un numéro de série crée l'appareil", () => {
    const r = valideSaisieOnt({ numeroSerie: " ALCL1234ABCD ", raison: "" }, aucun);
    expect(r).toEqual({ ok: true, mode: "numero", numeroSerie: "ALCL1234ABCD" });
  });

  test("une raison seule justifie l'absence d'ONT", () => {
    const r = valideSaisieOnt({ numeroSerie: "", raison: "Pas d'ONT sur place" }, aucun);
    expect(r).toEqual({ ok: true, mode: "absence", raison: "Pas d'ONT sur place" });
  });

  test("rien des deux : l'étape ne peut pas se fermer", () => {
    const r = valideSaisieOnt({ numeroSerie: "  ", raison: " " }, aucun);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/numéro de série|raison/i);
  });

  test("le numéro l'emporte si les deux sont remplis", () => {
    const r = valideSaisieOnt({ numeroSerie: "ALCL1234ABCD", raison: "peu importe" }, aucun);
    expect(r).toEqual({ ok: true, mode: "numero", numeroSerie: "ALCL1234ABCD" });
  });

  test("un numéro déjà attribué est refusé, avec le client qui le détient", () => {
    const existants = new Map([["ALCL1234ABCD", "AQUADOUCE SERVICE"]]);
    const r = valideSaisieOnt({ numeroSerie: "alcl1234abcd", raison: "" }, existants);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("AQUADOUCE SERVICE");
  });

  test("un numéro trop court est refusé : c'est une saisie tronquée", () => {
    const r = valideSaisieOnt({ numeroSerie: "AB12", raison: "" }, aucun);
    expect(r.ok).toBe(false);
  });
});

describe("normaliserNumeroSerie", () => {
  test("majuscules, sans espaces ni tirets", () => {
    expect(normaliserNumeroSerie(" alcl-1234 abcd ")).toBe("ALCL1234ABCD");
  });
});

describe("peutEntrerDansLot", () => {
  test("un ONT reçu et libre entre dans le lot", () => {
    expect(peutEntrerDansLot({ dateReception: new Date(), lotRetourId: null })).toBe(true);
  });

  test("un ONT jamais réceptionné n'entre pas", () => {
    expect(peutEntrerDansLot({ dateReception: null, lotRetourId: null })).toBe(false);
  });

  test("un ONT déjà dans un lot n'entre pas deux fois", () => {
    expect(peutEntrerDansLot({ dateReception: new Date(), lotRetourId: "lot1" })).toBe(false);
  });
});

describe("valideClotureLot", () => {
  const base = {
    nbArticles: 3,
    destinataire: "Grossiste",
    transporteur: "Chronopost",
    numeroSuivi: "XY123456789FR",
  };

  test("un lot complet part", () => {
    expect(valideClotureLot(base)).toEqual({ ok: true });
  });

  test("un lot vide ne part pas", () => {
    const r = valideClotureLot({ ...base, nbArticles: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/vide|aucun/i);
  });

  test("sans destinataire, on ne sait pas où il va", () => {
    expect(valideClotureLot({ ...base, destinataire: " " }).ok).toBe(false);
  });

  test("un numéro Chronopost invalide est refusé", () => {
    expect(valideClotureLot({ ...base, numeroSuivi: "123" }).ok).toBe(false);
  });

  test("DHL accepte ses propres formats de numéro", () => {
    const r = valideClotureLot({ ...base, transporteur: "DHL", numeroSuivi: "JVGL12345678" });
    expect(r).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `bun test lib/domain/staging/ 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: échec — le module `./ont` n'existe pas.

- [ ] **Step 3 : Implémenter**

Créer `lib/domain/staging/ont.ts` :

```ts
// Règles de la reprise des ONT chez les clients, sans base ni réseau : le chef de projet
// relève un numéro de série ou justifie l'absence d'appareil, le staging coche la réception,
// puis les ONT reçus repartent au grossiste par lots.

import { numeroSuiviValidePour } from "@/lib/domain/tracking/laposte";

/** Longueur minimale d'un numéro de série d'ONT : en dessous, c'est une saisie tronquée. */
const LONGUEUR_MIN_SERIE = 8;

export interface SaisieOnt {
  numeroSerie: string;
  raison: string;
}

export type ResultatSaisie =
  | { ok: true; mode: "numero"; numeroSerie: string }
  | { ok: true; mode: "absence"; raison: string }
  | { ok: false; message: string };

// Les constructeurs impriment le numéro avec des espaces ou des tirets qui varient d'une
// étiquette à l'autre ; seuls les caractères comptent pour l'identité de l'appareil.
export function normaliserNumeroSerie(brut: string): string {
  return brut.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * @param numerosExistants numéro de série normalisé → raison sociale du client qui le détient.
 */
export function valideSaisieOnt(
  saisie: SaisieOnt,
  numerosExistants: Map<string, string>
): ResultatSaisie {
  const numero = normaliserNumeroSerie(saisie.numeroSerie);
  const raison = saisie.raison.trim();

  if (numero) {
    if (numero.length < LONGUEUR_MIN_SERIE) {
      return { ok: false, message: "Numéro de série trop court, vérifiez l'étiquette." };
    }
    // Deux clients ne rendent pas le même appareil : c'est une faute de frappe, et la nommer
    // évite de chercher longtemps.
    const detenteur = numerosExistants.get(numero);
    if (detenteur) {
      return { ok: false, message: `Ce numéro est déjà enregistré pour ${detenteur}.` };
    }
    return { ok: true, mode: "numero", numeroSerie: numero };
  }

  if (raison) return { ok: true, mode: "absence", raison };

  return {
    ok: false,
    message: "Saisissez le numéro de série de l'ONT, ou la raison de son absence.",
  };
}

export function peutEntrerDansLot(article: {
  dateReception: Date | null;
  lotRetourId: string | null;
}): boolean {
  // Un ONT annoncé mais pas encore arrivé ne peut pas être mis dans un carton.
  return article.dateReception !== null && article.lotRetourId === null;
}

export function valideClotureLot(lot: {
  nbArticles: number;
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): { ok: true } | { ok: false; message: string } {
  if (lot.nbArticles === 0) {
    return { ok: false, message: "Le lot est vide : ajoutez au moins un ONT avant de l'expédier." };
  }
  if (!lot.destinataire.trim()) {
    return { ok: false, message: "Indiquez le destinataire du lot." };
  }
  if (!lot.transporteur.trim()) {
    return { ok: false, message: "Indiquez le transporteur." };
  }
  if (!numeroSuiviValidePour(lot.transporteur, lot.numeroSuivi)) {
    return { ok: false, message: `Numéro de suivi invalide pour ${lot.transporteur}.` };
  }
  return { ok: true };
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `bun test lib/domain/staging/ 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: `0 fail`.

- [ ] **Step 5 : Typecheck et suite complète**

Run: `npx tsc --noEmit && bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: typecheck vide, `0 fail`.

- [ ] **Step 6 : Commit**

```bash
git add lib/domain/staging/ont.ts lib/domain/staging/ont.test.ts
git commit -m "$(cat <<'EOF'
feat(staging): règles de reprise et de retour des ONT

Un numéro de série ou une raison d'absence, jamais rien ; un numéro déjà
enregistré est refusé en nommant le client qui le détient, parce que deux
clients ne rendent pas le même appareil.

Un lot ne part ni vide, ni sans destinataire, ni avec un numéro de suivi que
le transporteur ne reconnaîtrait pas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8 : Migration — l'étape « Récupérer l'ONT »

**Files:**
- Create: `prisma/migrations/20260902091000_etape_recuperer_ont/migration.sql`

**Interfaces:**
- Consumes: table `EtapeProjet` (existante).
- Produces: une ligne `EtapeProjet` d'`id` `ep_recuperer_ont` et de libellé `Récupérer l'ONT du client`.

- [ ] **Step 1 : Repérer la phase et l'ordre à utiliser**

Run:
```bash
grep -rn "phase" prisma/migrations/*/migration.sql | grep EtapeProjet -A0 | head
grep -rn "'Clôture Sewan'\|'Vérifications'\|'Client'" prisma/migrations/*/migration.sql | head
```
Expected: la liste des phases déjà employées. L'étape ONT se place dans la phase du jour de l'installation — reprendre **exactement** l'intitulé de phase déjà présent pour ce moment-là, sans en créer un nouveau. Si aucune phase ne correspond, utiliser `Vérifications`.

- [ ] **Step 2 : Écrire la migration**

Créer `prisma/migrations/20260902091000_etape_recuperer_ont/migration.sql` :

```sql
-- L'ONT du client est repris le jour de l'installation. L'étape réclame le numéro de série,
-- ou la raison de son absence quand il n'y a rien à reprendre.
-- Idempotent : ne recrée pas une étape déjà présente, ne touche pas aux libellés modifiés.

INSERT INTO "EtapeProjet" ("id", "libelle", "phase", "aide", "ordre", "actif", "creeLe", "majLe")
SELECT
  'ep_recuperer_ont',
  'Récupérer l''ONT du client',
  'Vérifications',
  'Relever le numéro de série sur l''étiquette de l''ONT. S''il n''y en a pas sur place, indiquer pourquoi : l''appareil est attendu au staging pour repartir au grossiste.',
  115,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "EtapeProjet" WHERE "libelle" = 'Récupérer l''ONT du client'
);
```

Remplacer `'Vérifications'` et `115` par la phase et l'ordre relevés au Step 1, de sorte que l'étape tombe au bon endroit dans la checklist.

- [ ] **Step 3 : Vérifier que le nom de dossier est postérieur à celui de la Task 2**

Run: `ls prisma/migrations | tail -4`
Expected: `20260902090000_ont_retour_et_frise` apparaît avant `20260902091000_etape_recuperer_ont`. L'ordre alphabétique fait foi.

- [ ] **Step 4 : Commit**

```bash
git add prisma/migrations/20260902091000_etape_recuperer_ont
git commit -m "$(cat <<'EOF'
feat(chef-projet): étape de reprise de l'ONT le jour de l'installation

Insertion idempotente : une étape déjà présente n'est ni recréée ni écrasée,
les libellés modifiés depuis Paramètres survivent au déploiement.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9 : Saisie de l'ONT dans la checklist du chef de projet

**Files:**
- Modify: `app/(app)/chef-projet/actions.ts`
- Modify: `app/(app)/chef-projet/ChecklistProjet.tsx`
- Modify: `lib/repositories/chefProjetRepository.ts`

**Interfaces:**
- Consumes: `valideSaisieOnt`, `normaliserNumeroSerie` (Task 7) ; `setSuiviProjet`, `setCommentaireProjet` (existants).
- Produces: `enregistrerOntAction(clientId: string, etapeId: string, numeroSerie: string, raison: string): Promise<{ success: boolean; error?: string }>` ; `DossierProjet` gagne `ontNumeroSerie: string | null`.

- [ ] **Step 1 : Écrire l'action serveur**

Dans `app/(app)/chef-projet/actions.ts`, ajouter :

```ts
// L'étape ONT ne se coche pas comme les autres : elle exige une saisie. Un numéro crée
// l'appareil au stock staging ; une raison ferme l'étape en « Aucun » sans rien créer.
export async function enregistrerOntAction(
  clientId: string,
  etapeId: string,
  numeroSerie: string,
  raison: string
): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };

  const numero = normaliserNumeroSerie(numeroSerie);
  // On ne charge que le numéro saisi, pas tout le stock : la vérification d'unicité doit
  // rester une requête indexée, pas un scan.
  const existants = new Map<string, string>();
  if (numero) {
    const deja = await prisma.articleStock.findFirst({
      where: { type: "ONT", numeroSerie: numero, archiveA: null },
      select: { clientFinalTexte: true, client: { select: { raisonSociale: true } } },
    });
    if (deja) {
      existants.set(numero, deja.client?.raisonSociale ?? deja.clientFinalTexte ?? "un autre dossier");
    }
  }

  const verdict = valideSaisieOnt({ numeroSerie, raison }, existants);
  if (!verdict.ok) return { success: false, error: verdict.message };

  if (verdict.mode === "numero") {
    await prisma.articleStock.create({
      data: {
        type: "ONT",
        origine: "CLIENT",
        numeroSerie: verdict.numeroSerie,
        clientId,
        statut: "EN_STOCK",
      },
    });
    await setSuiviProjet(clientId, etapeId, "Fait", session.user.email ?? null);
    await journaliser("Client", clientId, "ONT récupéré", verdict.numeroSerie);
  } else {
    await setSuiviProjet(clientId, etapeId, "Aucun", session.user.email ?? null);
    await setCommentaireProjet(clientId, etapeId, verdict.raison);
    await journaliser("Client", clientId, "ONT absent", verdict.raison);
  }

  revalidatePath("/chef-projet");
  revalidatePath("/staging/ont");
  return { success: true };
}
```

Ajouter en tête de fichier les imports manquants :

```ts
import { normaliserNumeroSerie, valideSaisieOnt } from "@/lib/domain/staging/ont";
```

`prisma` est peut-être déjà importé ; ne pas le dupliquer.

- [ ] **Step 2 : Remonter l'ONT déjà saisi**

Dans `lib/repositories/chefProjetRepository.ts`, ajouter à l'interface `DossierProjet` :

```ts
  /** Numéro de série de l'ONT repris chez ce client, s'il a été saisi. */
  ontNumeroSerie: string | null;
```

Dans `fetchChefProjet`, charger les ONT des clients affichés en **une seule requête** — pas une par dossier :

```ts
  const onts = await prisma.articleStock.findMany({
    where: { type: "ONT", archiveA: null, clientId: { in: clients.map((c) => c.id) } },
    select: { clientId: true, numeroSerie: true },
  });
  const ontParClient = new Map(onts.map((o) => [o.clientId, o.numeroSerie]));
```

puis renseigner `ontNumeroSerie: ontParClient.get(c.id) ?? null` dans la construction de chaque `DossierProjet`. Adapter les noms de variables à ceux réellement en place dans la fonction.

- [ ] **Step 3 : Ajouter la saisie dans la checklist**

Dans `app/(app)/chef-projet/ChecklistProjet.tsx`, repérer la constante identifiant l'étape ONT :

```tsx
// L'étape de reprise de l'ONT ne se pilote pas par le sélecteur de statut : elle réclame un
// numéro de série ou une raison d'absence, et c'est la saisie qui décide du statut.
const LIBELLE_ETAPE_ONT = "Récupérer l'ONT du client";
```

Dans `LigneEtape`, quand `etape.libelle === LIBELLE_ETAPE_ONT`, remplacer le sélecteur de statut par ce bloc :

```tsx
<SaisieOnt
  clientId={dossier.clientId}
  etapeId={etape.id}
  numeroExistant={dossier.ontNumeroSerie}
  raisonExistante={suivi?.commentaire ?? ""}
  statut={statut}
/>
```

et ajouter le composant en bas du fichier :

```tsx
// Deux champs, un seul suffit : le numéro relevé sur l'étiquette, ou la raison de l'absence.
// Le statut de l'étape découle de la saisie, il n'est pas choisi à la main.
function SaisieOnt({
  clientId,
  etapeId,
  numeroExistant,
  raisonExistante,
  statut,
}: {
  clientId: string;
  etapeId: string;
  numeroExistant: string | null;
  raisonExistante: string;
  statut: string;
}) {
  const [numero, setNumero] = useState(numeroExistant ?? "");
  const [raison, setRaison] = useState(raisonExistante);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (numeroExistant) {
    return (
      <span className="ev-badge" style={{ background: "var(--pal-green-bg)", color: "var(--pal-green-fg)" }}>
        <span className="ev-badge-dot" style={{ background: "var(--pal-green-dot)" }} />
        ONT {numeroExistant}
      </span>
    );
  }

  const enregistrer = async () => {
    setEnCours(true);
    setErreur(null);
    const r = await enregistrerOntAction(clientId, etapeId, numero, raison);
    setEnCours(false);
    if (!r.success) setErreur(r.error ?? "Échec de l'enregistrement.");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="N° de série de l'ONT"
          className="h-8 w-44 rounded-md border px-2 font-mono text-xs"
        />
        <input
          value={raison}
          onChange={(e) => setRaison(e.target.value)}
          placeholder="ou raison de l'absence"
          className="h-8 w-52 rounded-md border px-2 text-xs"
        />
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="h-8 rounded-md border px-3 text-xs font-semibold disabled:opacity-50"
        >
          {enCours ? "…" : "Enregistrer"}
        </button>
      </div>
      {erreur ? (
        <span className="text-[11px]" style={{ color: "var(--pal-red-fg)" }}>
          {erreur}
        </span>
      ) : null}
      {statut === "Aucun" && raisonExistante ? (
        <span className="text-[11px] text-muted-foreground">Sans ONT : {raisonExistante}</span>
      ) : null}
    </div>
  );
}
```

Ajouter les imports nécessaires en tête de fichier : `useState` depuis `react` s'il n'y est pas, et `enregistrerOntAction` depuis `./actions`.

Vérifier que `dossier.clientId` est bien le nom du champ dans `DossierProjet` (`grep -n "clientId" lib/repositories/chefProjetRepository.ts`) et l'ajuster si besoin.

- [ ] **Step 4 : Vérifier**

Run: `npx tsc --noEmit && bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: typecheck vide, `0 fail`.

- [ ] **Step 5 : Vérifier à l'écran**

Sur `/chef-projet`, ouvrir un dossier et la phase contenant l'étape ONT. Saisir un numéro : l'étape passe à « Fait » et affiche le badge. Sur un autre dossier, saisir une raison seule : l'étape passe à « Aucun » et la raison s'affiche. Ressaisir le même numéro sur un troisième dossier : le message doit nommer le client qui le détient déjà.

- [ ] **Step 6 : Commit**

```bash
git add "app/(app)/chef-projet/actions.ts" "app/(app)/chef-projet/ChecklistProjet.tsx" lib/repositories/chefProjetRepository.ts
git commit -m "$(cat <<'EOF'
feat(chef-projet): saisie de l'ONT récupéré le jour de l'installation

Un numéro de série crée l'appareil au stock staging et ferme l'étape ; une
raison la ferme en « Aucun » sans rien créer. Le statut découle de la saisie
plutôt que d'être choisi à la main, sinon l'étape se coche sans le numéro.

Le contrôle d'unicité passe par une requête indexée sur le numéro saisi, pas
par un chargement du stock.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10 : Dépôt des ONT et des lots

**Files:**
- Create: `lib/repositories/ontRepository.ts`

**Interfaces:**
- Consumes: `peutEntrerDansLot`, `valideClotureLot` (Task 7) ; modèles `ArticleStock`, `LotRetourOnt` (Task 2).
- Produces :
  - `interface OntLigne { id: string; numeroSerie: string; client: string | null; saisiLe: string; dateReception: string | null }`
  - `interface LotOnt { id: string; destinataire: string; transporteur: string | null; numeroSuivi: string | null; expedieLe: string | null; suiviStatut: string | null; suiviLibelle: string | null; suiviEtape: number | null; suiviLivreLe: string | null; articles: OntLigne[] }`
  - `fetchOntsAnnonces(): Promise<OntLigne[]>`
  - `fetchLotOuvert(): Promise<LotOnt | null>`
  - `fetchLotsPartis(): Promise<LotOnt[]>`
  - `cocherReceptionOnt(id: string, recu: boolean): Promise<void>`
  - `verserDansLot(articleId: string): Promise<{ ok: boolean; message?: string }>`
  - `retirerDuLot(articleId: string): Promise<void>`
  - `cloreLot(champs: { destinataire: string; transporteur: string; numeroSuivi: string }): Promise<{ ok: true; lotId: string } | { ok: false; message: string }>`

- [ ] **Step 1 : Écrire le dépôt**

Créer `lib/repositories/ontRepository.ts` :

```ts
// Accès base pour la reprise des ONT. Les règles vivent dans lib/domain/staging/ont.ts ;
// ici on ne fait que lire, écrire, et appliquer leur verdict.

import { prisma } from "@/lib/prisma";
import { peutEntrerDansLot, valideClotureLot } from "@/lib/domain/staging/ont";

export interface OntLigne {
  id: string;
  numeroSerie: string;
  client: string | null;
  saisiLe: string;
  dateReception: string | null;
}

export interface LotOnt {
  id: string;
  destinataire: string;
  transporteur: string | null;
  numeroSuivi: string | null;
  expedieLe: string | null;
  suiviStatut: string | null;
  suiviLibelle: string | null;
  suiviEtape: number | null;
  suiviLivreLe: string | null;
  articles: OntLigne[];
}

const jour = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

const SELECT_ONT = {
  id: true,
  numeroSerie: true,
  creeLe: true,
  dateReception: true,
  clientFinalTexte: true,
  client: { select: { raisonSociale: true } },
} as const;

type LigneBrute = {
  id: string;
  numeroSerie: string;
  creeLe: Date;
  dateReception: Date | null;
  clientFinalTexte: string | null;
  client: { raisonSociale: string } | null;
};

function versLigne(a: LigneBrute): OntLigne {
  return {
    id: a.id,
    numeroSerie: a.numeroSerie,
    client: a.client?.raisonSociale ?? a.clientFinalTexte,
    saisiLe: a.creeLe.toISOString().slice(0, 10),
    dateReception: jour(a.dateReception),
  };
}

// Saisis par un chef de projet mais pas encore dans un lot : ceux du haut ne sont même pas
// arrivés physiquement, et c'est là qu'un appareil se perd.
export async function fetchOntsAnnonces(): Promise<OntLigne[]> {
  const articles = await prisma.articleStock.findMany({
    where: { type: "ONT", archiveA: null, lotRetourId: null },
    select: SELECT_ONT,
    orderBy: [{ dateReception: "asc" }, { creeLe: "asc" }],
  });
  return articles.map(versLigne);
}

// Le panier courant du staging : un seul lot ouvert à la fois.
export async function fetchLotOuvert(): Promise<LotOnt | null> {
  const lot = await prisma.lotRetourOnt.findFirst({
    where: { expedieLe: null },
    orderBy: { creeLe: "desc" },
    include: { articles: { select: SELECT_ONT } },
  });
  return lot ? versLot(lot) : null;
}

export async function fetchLotsPartis(): Promise<LotOnt[]> {
  const lots = await prisma.lotRetourOnt.findMany({
    where: { expedieLe: { not: null } },
    orderBy: { expedieLe: "desc" },
    include: { articles: { select: SELECT_ONT } },
  });
  return lots.map(versLot);
}

function versLot(lot: {
  id: string;
  destinataire: string;
  transporteur: string | null;
  numeroSuivi: string | null;
  expedieLe: Date | null;
  suiviStatut: string | null;
  suiviLibelle: string | null;
  suiviEtape: number | null;
  suiviLivreLe: Date | null;
  articles: LigneBrute[];
}): LotOnt {
  return {
    id: lot.id,
    destinataire: lot.destinataire,
    transporteur: lot.transporteur,
    numeroSuivi: lot.numeroSuivi,
    expedieLe: jour(lot.expedieLe),
    suiviStatut: lot.suiviStatut,
    suiviLibelle: lot.suiviLibelle,
    suiviEtape: lot.suiviEtape,
    suiviLivreLe: jour(lot.suiviLivreLe),
    articles: lot.articles.map(versLigne),
  };
}

export async function cocherReceptionOnt(id: string, recu: boolean): Promise<void> {
  await prisma.articleStock.update({
    where: { id },
    data: { dateReception: recu ? new Date() : null },
  });
}

export async function verserDansLot(articleId: string): Promise<{ ok: boolean; message?: string }> {
  const article = await prisma.articleStock.findUnique({
    where: { id: articleId },
    select: { dateReception: true, lotRetourId: true },
  });
  if (!article) return { ok: false, message: "ONT introuvable." };
  if (!peutEntrerDansLot(article)) {
    return { ok: false, message: "Cochez d'abord la réception de cet ONT." };
  }

  // Le lot ouvert se crée à la volée : le staging n'a pas à l'ouvrir explicitement avant de
  // poser son premier appareil dedans.
  const ouvert =
    (await prisma.lotRetourOnt.findFirst({ where: { expedieLe: null }, select: { id: true } })) ??
    (await prisma.lotRetourOnt.create({ data: { destinataire: "" }, select: { id: true } }));

  await prisma.articleStock.update({
    where: { id: articleId },
    data: { lotRetourId: ouvert.id },
  });
  return { ok: true };
}

export async function retirerDuLot(articleId: string): Promise<void> {
  await prisma.articleStock.update({ where: { id: articleId }, data: { lotRetourId: null } });
}

export async function cloreLot(champs: {
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): Promise<{ ok: true; lotId: string } | { ok: false; message: string }> {
  const lot = await prisma.lotRetourOnt.findFirst({
    where: { expedieLe: null },
    orderBy: { creeLe: "desc" },
    select: { id: true, _count: { select: { articles: true } } },
  });
  if (!lot) return { ok: false, message: "Aucun lot en préparation." };

  const verdict = valideClotureLot({ nbArticles: lot._count.articles, ...champs });
  if (!verdict.ok) return { ok: false, message: verdict.message };

  // Le départ du lot et le passage de ses ONT en ENVOYE sont indissociables : un lot parti
  // dont les appareils seraient restés « en stock » les rendrait éligibles à un second lot.
  await prisma.$transaction([
    prisma.lotRetourOnt.update({
      where: { id: lot.id },
      data: {
        destinataire: champs.destinataire.trim(),
        transporteur: champs.transporteur.trim(),
        numeroSuivi: champs.numeroSuivi.trim(),
        expedieLe: new Date(),
      },
    }),
    prisma.articleStock.updateMany({
      where: { lotRetourId: lot.id },
      data: { statut: "ENVOYE", dateEnvoi: new Date() },
    }),
  ]);
  return { ok: true, lotId: lot.id };
}
```

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Si Prisma se plaint d'un champ inconnu, c'est que `npx prisma generate` n'a pas été relancé depuis la Task 2 — le refaire.

- [ ] **Step 3 : Commit**

```bash
git add lib/repositories/ontRepository.ts
git commit -m "$(cat <<'EOF'
feat(staging): dépôt des ONT récupérés et de leurs lots de retour

Le lot ouvert se crée à la volée au premier ONT versé : le staging n'a pas à
l'ouvrir avant d'y poser un appareil.

La clôture est transactionnelle — un lot parti dont les ONT seraient restés
« en stock » les rendrait éligibles à un second lot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11 : Page staging des ONT

**Files:**
- Create: `app/(app)/staging/ont/page.tsx`
- Create: `app/(app)/staging/ont/OntStaging.tsx`
- Modify: `app/(app)/staging/actions.ts`
- Modify: `app/(app)/staging/page.tsx`

**Interfaces:**
- Consumes: `fetchOntsAnnonces`, `fetchLotOuvert`, `fetchLotsPartis`, `cocherReceptionOnt`, `verserDansLot`, `retirerDuLot`, `cloreLot` (Task 10) ; `FriseColis` (Task 4) ; `SectionStaging`, `PageHero`, `BarreRecherche`, `correspond` (existants).
- Produces: les actions serveur `cocherReceptionOntAction`, `verserDansLotAction`, `retirerDuLotAction`, `cloreLotAction`.

- [ ] **Step 1 : Écrire les actions serveur**

Ajouter à `app/(app)/staging/actions.ts`, en suivant la forme des actions déjà présentes dans le fichier (authentification, `revalidatePath`, journalisation) :

```ts
export async function cocherReceptionOntAction(id: string, recu: boolean): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await cocherReceptionOnt(id, recu);
  await journaliser("ArticleStock", id, "Réception ONT", recu ? "reçu" : "annulé");
  revalidatePath("/staging/ont");
  return { success: true };
}

export async function verserDansLotAction(articleId: string): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const r = await verserDansLot(articleId);
  if (!r.ok) return { success: false, error: r.message };
  revalidatePath("/staging/ont");
  return { success: true };
}

export async function retirerDuLotAction(articleId: string): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  await retirerDuLot(articleId);
  revalidatePath("/staging/ont");
  return { success: true };
}

export async function cloreLotAction(champs: {
  destinataire: string;
  transporteur: string;
  numeroSuivi: string;
}): Promise<Resultat> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Non authentifié." };
  const r = await cloreLot(champs);
  if (!r.ok) return { success: false, error: r.message };
  await journaliser("LotRetourOnt", r.lotId, "Lot ONT expédié", champs.destinataire);
  revalidatePath("/staging/ont");
  revalidatePath("/staging");
  return { success: true };
}
```

Le type `Resultat` existe déjà dans ce fichier ; ne pas le redéfinir. Ajouter l'import des fonctions du dépôt ONT.

- [ ] **Step 2 : Écrire la page serveur**

Créer `app/(app)/staging/ont/page.tsx` :

```tsx
import {
  fetchLotOuvert,
  fetchLotsPartis,
  fetchOntsAnnonces,
} from "@/lib/repositories/ontRepository";
import { PageHero } from "@/components/PageHero";
import { OntStaging } from "./OntStaging";

export const dynamic = "force-dynamic";

export default async function OntPage() {
  const [annonces, lotOuvert, lotsPartis] = await Promise.all([
    fetchOntsAnnonces(),
    fetchLotOuvert(),
    fetchLotsPartis(),
  ]);

  const enAttente = annonces.filter((o) => !o.dateReception).length;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-purple)"
        label="Staging"
        title="ONT récupérés"
        kpis={[
          { value: enAttente, label: "annoncés, pas arrivés" },
          { value: lotOuvert?.articles.length ?? 0, label: "dans le lot", color: "var(--ev-amber)" },
          { value: lotsPartis.length, label: "lots partis", color: "var(--ev-green)" },
        ]}
      />
      <OntStaging annonces={annonces} lotOuvert={lotOuvert} lotsPartis={lotsPartis} />
    </main>
  );
}
```

- [ ] **Step 3 : Écrire le composant client**

Créer `app/(app)/staging/ont/OntStaging.tsx` :

```tsx
"use client";

import { useState } from "react";
import { Boxes, PackageCheck, Send } from "lucide-react";
import type { LotOnt, OntLigne } from "@/lib/repositories/ontRepository";
import { SectionStaging } from "../SectionStaging";
import { FriseColis } from "@/components/FriseColis";
import { BarreRecherche, correspond } from "@/components/BarreRecherche";
import { useRafraichissementAuto } from "@/components/useRafraichissementAuto";
import {
  cloreLotAction,
  cocherReceptionOntAction,
  retirerDuLotAction,
  verserDansLotAction,
} from "../actions";

export function OntStaging({
  annonces,
  lotOuvert,
  lotsPartis,
}: {
  annonces: OntLigne[];
  lotOuvert: LotOnt | null;
  lotsPartis: LotOnt[];
}) {
  useRafraichissementAuto();
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const visibles = annonces.filter((o) => correspond([o.numeroSerie, o.client], recherche));

  const agir = async (promesse: Promise<{ success: boolean; error?: string }>) => {
    const r = await promesse;
    setErreur(r.success ? null : (r.error ?? "Échec."));
  };

  return (
    <div className="flex flex-col gap-5">
      {erreur ? (
        <p className="rounded-md px-3 py-2 text-xs"
           style={{ background: "var(--pal-red-bg)", color: "var(--pal-red-fg)" }}>
          {erreur}
        </p>
      ) : null}

      <SectionStaging
        couleur="var(--ev-blue)"
        icone={<Boxes className="size-4" />}
        titre="ONT annoncés"
        compteur={visibles.length}
      >
        <BarreRecherche
          valeur={recherche}
          onChange={setRecherche}
          placeholder="N° de série ou client"
          nbVisibles={visibles.length}
          nbTotal={annonces.length}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">Numéro de série</th>
              <th>Client</th>
              <th>Saisi le</th>
              <th>Reçu chez nous</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="py-2 font-mono text-xs">{o.numeroSerie}</td>
                <td>{o.client ?? "—"}</td>
                <td className="text-xs text-muted-foreground">{o.saisiLe}</td>
                <td>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={!!o.dateReception}
                      onChange={(e) => agir(cocherReceptionOntAction(o.id, e.target.checked))}
                    />
                    {o.dateReception ?? "en attente"}
                  </label>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    disabled={!o.dateReception}
                    onClick={() => agir(verserDansLotAction(o.id))}
                    className="h-7 rounded-md border px-2 text-xs disabled:opacity-40"
                    title={o.dateReception ? "Ajouter au lot en préparation" : "Cochez d'abord la réception"}
                  >
                    Ajouter au lot
                  </button>
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                  Aucun ONT en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-amber)"
        icone={<PackageCheck className="size-4" />}
        titre="Lot en préparation"
        compteur={lotOuvert?.articles.length ?? 0}
      >
        <LotEnPreparation lot={lotOuvert} onErreur={setErreur} />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-green)"
        icone={<Send className="size-4" />}
        titre="Lots partis"
        compteur={lotsPartis.length}
      >
        <div className="flex flex-col gap-4">
          {lotsPartis.map((lot) => (
            <div key={lot.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{lot.destinataire}</span>
                <span className="text-xs text-muted-foreground">
                  {lot.articles.length} ONT · parti le {lot.expedieLe}
                </span>
              </div>
              <FriseColis
                etape={lot.suiviEtape}
                libelle={lot.suiviLibelle}
                livreLe={lot.suiviLivreLe}
                transporteur={lot.transporteur}
                numeroSuivi={lot.numeroSuivi}
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                {lot.articles.map((a) => a.numeroSerie).join(" · ")}
              </p>
            </div>
          ))}
          {lotsPartis.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Aucun lot expédié.</p>
          ) : null}
        </div>
      </SectionStaging>
    </div>
  );
}

function LotEnPreparation({
  lot,
  onErreur,
}: {
  lot: LotOnt | null;
  onErreur: (m: string | null) => void;
}) {
  const [destinataire, setDestinataire] = useState(lot?.destinataire ?? "");
  const [transporteur, setTransporteur] = useState("Chronopost");
  const [numeroSuivi, setNumeroSuivi] = useState("");

  if (!lot || lot.articles.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Aucun ONT dans le lot. Cochez la réception d'un ONT puis ajoutez-le.
      </p>
    );
  }

  const expedier = async () => {
    const r = await cloreLotAction({ destinataire, transporteur, numeroSuivi });
    onErreur(r.success ? null : (r.error ?? "Échec."));
    if (r.success) setNumeroSuivi("");
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {lot.articles.map((a) => (
          <li key={a.id} className="flex items-center justify-between border-b py-1.5 text-sm">
            <span className="font-mono text-xs">{a.numeroSerie}</span>
            <span className="text-xs text-muted-foreground">{a.client ?? "—"}</span>
            <button
              type="button"
              onClick={async () => {
                const r = await retirerDuLotAction(a.id);
                onErreur(r.success ? null : (r.error ?? "Échec."));
              }}
              className="h-7 rounded-md border px-2 text-xs"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={destinataire}
          onChange={(e) => setDestinataire(e.target.value)}
          placeholder="Destinataire (grossiste)"
          className="h-8 w-56 rounded-md border px-2 text-xs"
        />
        <select
          value={transporteur}
          onChange={(e) => setTransporteur(e.target.value)}
          className="h-8 rounded-md border px-2 text-xs"
        >
          <option>Chronopost</option>
          <option>DHL</option>
        </select>
        <input
          value={numeroSuivi}
          onChange={(e) => setNumeroSuivi(e.target.value)}
          placeholder="N° de suivi"
          className="h-8 w-44 rounded-md border px-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={expedier}
          className="h-8 rounded-md border px-3 text-xs font-semibold"
        >
          Expédier le lot
        </button>
      </div>
    </div>
  );
}
```

Les signatures utilisées ici ont été relevées dans le dépôt : `SectionStaging({ couleur, icone, titre, compteur, droite, children })`, `BarreRecherche({ valeur, onChange, placeholder, nbVisibles, nbTotal })`, `correspond(champs, recherche)` — les champs d'abord, la recherche ensuite.

- [ ] **Step 4 : Ajouter la tuile sur le portail staging**

Dans `app/(app)/staging/page.tsx`, ajouter `fetchOntsAnnonces` au `Promise.all` et une cinquième tuile :

```tsx
        <Tuile
          href="/staging/ont"
          couleur="var(--ev-purple)"
          icone={<HardDrive className="size-6" />}
          titre="ONT"
          compteur={ontsAnnonces.filter((o) => !o.dateReception).length}
          libelleCompteur="à réceptionner"
        />
```

Importer `HardDrive` depuis `lucide-react`. Passer la grille à `lg:grid-cols-5` pour que les cinq tuiles tiennent sur une ligne.

- [ ] **Step 5 : Vérifier**

Run: `npx tsc --noEmit && bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: typecheck vide, `0 fail`.

- [ ] **Step 6 : Vérifier à l'écran**

Ouvrir `/staging` : la tuile ONT apparaît avec son compteur. Ouvrir `/staging/ont` : les trois zones s'affichent. Cocher une réception, ajouter l'ONT au lot, tenter d'expédier sans destinataire (refus explicite), puis expédier avec destinataire, transporteur et numéro : le lot bascule dans « Lots partis » avec sa frise.

- [ ] **Step 7 : Commit**

```bash
git add "app/(app)/staging/ont" "app/(app)/staging/actions.ts" "app/(app)/staging/page.tsx"
git commit -m "$(cat <<'EOF'
feat(staging): page de réception et de retour des ONT

Trois zones : les ONT annoncés par les chefs de projet, avec la coche de
réception qui révèle ceux qui ne sont jamais arrivés ; le lot en préparation ;
les lots partis avec leur frise de livraison.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12 : Vérification de bout en bout et déploiement

**Files:**
- Aucun fichier modifié par défaut — cette tâche vérifie et corrige ce qui résiste.

- [ ] **Step 1 : Suite complète et typecheck**

Run: `npx tsc --noEmit && bun test 2>&1 | grep -E "^\(fail\)|^ *[0-9]+ (pass|fail)"`
Expected: typecheck vide, `0 fail`. Ne pas utiliser `tail` : il masque les échecs.

- [ ] **Step 2 : Build de production**

Run: `npx next build`
Expected: succès. En cas d'`exit 137` (OOM), c'est la mémoire de la machine et non le code : `NODE_OPTIONS="--max-old-space-size=4096" npx next build`.

- [ ] **Step 3 : Vérifier l'ordre des migrations**

Run: `ls prisma/migrations | tail -5`
Expected: `20260902090000_ont_retour_et_frise` précède `20260902091000_etape_recuperer_ont`. La seconde insère une ligne dans une table préexistante, mais l'ordre reste vérifié par principe.

- [ ] **Step 4 : Parcours complet en local**

Sur une base de développement contenant au moins un dossier client :
1. `/chef-projet` — saisir un numéro de série d'ONT sur un dossier.
2. `/staging/ont` — l'ONT apparaît dans « annoncés », sans date de réception.
3. Cocher la réception, l'ajouter au lot, expédier le lot avec un numéro Chronopost.
4. Le lot passe dans « Lots partis », sa frise s'affiche à l'étape « Expédié ».
5. Sur un autre dossier, saisir une raison d'absence : l'étape passe à « Aucun », aucun ONT n'apparaît au staging.

- [ ] **Step 5 : Pousser**

```bash
git push origin main
```

- [ ] **Step 6 : Surveiller le déploiement**

Run:
```bash
until [ "$(gh run list --limit 1 --json status -q '.[0].status')" = "completed" ]; do sleep 20; done
gh run list --limit 1 --json conclusion,displayTitle -q '.[0] | .conclusion + " — " + .displayTitle'
```
Expected: `success`. En cas d'échec, lire le journal (`gh run view --log-failed`) : une erreur SQL inattendue fait volontairement échouer `scripts/deploy-migrate.sh`.

- [ ] **Step 7 : Vérifier en production, en lecture seule**

Ouvrir `/staging/ont` en production : la page répond, les trois zones sont vides mais présentes. Ouvrir un dossier sur `/chef-projet` : l'étape « Récupérer l'ONT du client » figure dans sa phase avec ses deux champs.

---

## Notes pour l'exécutant

**Ce qui casse silencieusement dans ce dépôt** — appris à ses dépens :

- `bun test | tail -2` masque les échecs. Toujours filtrer avec le `grep` donné.
- Une migration mal datée s'exécute avant sa dépendance, échoue, et le script la marque quand même appliquée. Vérifier l'ordre alphabétique des dossiers.
- `pm2 reload` **sans** `--update-env` : c'est délibéré, `/etc/environment` contient un `DATABASE_URL` d'un autre projet qui écrase celui de l'application.
- `git add -A` a déjà poussé un fichier client contenant des identifiants dans un dépôt public. Ajouter les fichiers un par un.
- Plusieurs sessions travaillent parfois sur ce dépôt en parallèle. Avant de créer une fonction ou un composant, vérifier qu'il n'existe pas déjà (`grep -rn "nomDeLaFonction" lib app`).
