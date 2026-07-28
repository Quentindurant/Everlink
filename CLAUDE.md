## Approche
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Projet
Outil interne de provisionnement et de bascule d'opérateur téléphonique, de SEWAN vers UNYC.
Remplace un Google Sheet. La spec fonctionnelle fait foi: `SPEC.md`. Le modèle de données de
référence est `prisma/schema.prisma`. En cas de contradiction entre le code et SPEC.md, corriger le
code ou signaler l'écart, ne pas diverger en silence.

## Stack
Next.js App Router, TypeScript, Prisma, PostgreSQL, Tailwind, shadcn/ui, TanStack Table.
Docker et docker-compose pour le déploiement sur VPS. Pas de NestJS.
Vérifier les versions et les API dans la doc officielle avant de scaffolder, ne rien écrire de mémoire.

## Invariants métier
À ne jamais casser, ce sont les règles qui rendent les exports acceptés par l'opérateur cible.

- La raison sociale du client est la clé d'export. Elle est stockée et exportée telle quelle, jamais
  reformatée, jamais mise en casse différente, jamais trimée autrement que sur les espaces de bord.
- Les adresses MAC sont exportées telles que saisies, espaces de bord exclus. Les IPUI DECT à 10
  caractères hexadécimaux et les MAC à deux-points coexistent. Toute normalisation reste interne et
  ne sort jamais dans un fichier.
- Les numéros sortent en texte, format de cellule `@`, zéro initial conservé.
- L'export SDA est trié par raison sociale. L'export MAC suit l'ordre de saisie des clients.
  Ce n'est pas une incohérence à corriger, c'est le format attendu.
- Le filtre d'éligibilité est piloté par `ModeleEquipement.eligibleExport`, jamais par une liste de
  marques codée en dur.
- Un import ne doit jamais échouer en bloc sur une donnée sale. Il importe ce qu'il peut et produit
  un rapport.
- Les imports sont idempotents. Rejouer un fichier ne crée pas de doublon et n'écrase pas une saisie
  faite dans l'application.

## Données de test
`docs/samples/` contient les fichiers réels fournis par le métier. Les tests d'acceptation de la
section 11 de SPEC.md comparent les exports générés à ces golden files. Ne pas les modifier.
Ne jamais ajuster un test pour le faire passer: si un compte ne tombe pas juste, la règle est mal
implémentée ou la spec est fausse, dans ce cas le signaler.

## Base de données
- Migrations Prisma versionnées et commitées. Jamais de `prisma db push` hors développement local.
- Suppression logique via `archiveA`. Pas de `DELETE` sur les données métier.
- Le seed initialise: listes de valeurs, catalogue des modèles d'équipement avec leur éligibilité,
  étapes de suivi téléphonie, un compte ADMIN.

## Interface
- Libellés en français, identiques à ceux du Sheet d'origine, y compris les accents et la
  ponctuation des en-têtes de colonnes.
- Densité de type tableur sur la page Provisionning: lignes compactes, édition inline, navigation
  clavier. Pas de modale pour modifier une cellule.
- Toute action de masse est réversible ou confirmée.

## Conventions
- Logique métier dans `lib/domain/`, pure et testable, sans dépendance à Prisma ni à Next.
  Les règles de contrôle, d'éligibilité et de construction des exports vivent là.
- Accès données dans `lib/repositories/`. Les Route Handlers et Server Actions orchestrent, ils ne
  contiennent pas de règle métier.
- Tests unitaires sur `lib/domain/`, tests d'intégration sur les imports et les exports.
- Messages de commit courts, en anglais, à l'impératif.
