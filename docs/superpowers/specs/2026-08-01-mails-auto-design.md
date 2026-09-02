# Mails auto (SMTP + templates éditables) — Design

**Date :** 2026-08-01
**Chantier :** 2/4 des améliorations issues des CR COPIL (statuts fait ; restent lien ADV, techniciens).
**Objectif :** générer et **envoyer** les mails de migration (prévenance J-15 + confirmation RDV) depuis l'app, à partir de templates éditables, avec les données du client injectées automatiquement, et tracer chaque envoi.

## 1. Périmètre

**Dans le périmètre :**
- Templates de mail éditables dans Paramètres (objet + corps, variables `{...}`).
- Envoi SMTP réel depuis `migration.ext@everlink-services.fr`.
- Onglet "Mails" sur la fiche client : choisir un template, prévisualiser rempli, saisir date/créneau, envoyer.
- Trace de chaque envoi + historique.
- Auto-avancement de l'étape de migration à l'envoi (prévenance → "Prévenance envoyée", confirmation → "RDV planifié").
- Seed des 6 mails du doc `Templates_Communication_Migration_v3.5_VERSION_EV.docx`.

**Hors périmètre (YAGNI) :** pièces jointes, envoi programmé/différé (le J-15 est calculé mais l'envoi reste déclenché manuellement), éditeur riche (le corps est du texte simple).

## 2. Modèle de données

```prisma
enum TypeMail {
  PREVENANCE
  CONFIRMATION
}

model ModeleMail {
  id       String   @id @default(cuid())
  // Libellé de scénario, libre (ex "Centrex + FTTH — sur site"). Sert au regroupement et à
  // la suggestion; l'opérateur choisit finalement le template à l'envoi.
  scenario String
  type     TypeMail
  objet    String
  corps    String   @db.Text
  actif    Boolean  @default(true)
  ordre    Int      @default(0)
  creeLe   DateTime @default(now())
  majLe    DateTime @updatedAt

  @@index([type])
}

model MailEnvoi {
  id           String   @id @default(cuid())
  client       Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  clientId     String
  type         TypeMail
  destinataire String
  objet        String
  corps        String   @db.Text
  succes       Boolean  @default(true)
  erreur       String?
  auteur       UtilisateurApp? @relation(fields: [auteurId], references: [id])
  auteurId     String?
  creeLe       DateTime @default(now())

  @@index([clientId, creeLe])
}
```

`Client` : ajout `creneauIntervention String?` (ex "9h-13h"). `dateIntervention` existe déjà.
`Client` reçoit la relation inverse `mailEnvois MailEnvoi[]`. `UtilisateurApp` reçoit `mailEnvois MailEnvoi[]`.

## 3. Domaine (pur, testé)

`lib/domain/mail/substitution.ts` :

```ts
export interface VariablesMail {
  civilite_nom: string; nom_client: string; filiale: string; adresse: string;
  date: string; creneau: string; numero_gc: string;
}
export const VARIABLES_DISPONIBLES: (keyof VariablesMail)[];
// Remplace {cle} par sa valeur. Une clé inconnue est laissée telle quelle (pas de trou silencieux).
export function substituer(gabarit: string, variables: Partial<VariablesMail>): string;
```

Tests : substitution simple, variable manquante laissée `{...}`, accents/ponctuation préservés, plusieurs occurrences.

## 4. Envoi SMTP

- Dépendance : `nodemailer`.
- `lib/mail/mailer.ts` : `envoyerMail({ to, subject, text }): Promise<{ success: boolean; error?: string }>`. Lit la config SMTP en env : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Si config absente → renvoie une erreur claire, sans crash.
- Ajout à `.env.example`.

## 5. Repository

`lib/repositories/mailRepository.ts` :
- `listModelesMail(type?)` — templates actifs, ordonnés.
- `fetchModelesMailParam()` — tous (Paramètres).
- CRUD ModeleMail (ajouter, modifier objet/corps/scenario, activer, supprimer).
- `enregistrerEnvoi(...)`, `fetchEnvois(clientId)`.
- `buildVariablesClient(client, date, creneau)` — construit `VariablesMail` depuis un client (civilité+nom contact, raison sociale, filiale, adresse, `SMTP`/GC depuis env `NUMERO_GC`).

## 6. Actions serveur

`app/(app)/clients/[id]/mailActions.ts` :
- `envoyerMailAction(clientId, modeleId, destinataire, objet, corps)` — envoie via mailer, enregistre `MailEnvoi`, et si succès avance l'étape (mapping `PREVENANCE → "Prévenance envoyée"`, `CONFIRMATION → "RDV planifié"` via lookup par libellé). Garde `auth()`.
- `setCreneauInterventionAction(clientId, date, creneau)` — persiste date + créneau.

## 7. UI — fiche client, onglet "Mails"

Nouvel onglet dans `FicheClient` :
- Sélecteur de template (liste des `ModeleMail` actifs ; défaut = celui dont `scenario` matche `client.scenario`, sinon le 1er).
- Champs éditables : destinataire (défaut `client.contactEmail`), date, créneau (défaut `client.dateIntervention`/`creneauIntervention`).
- **Prévisualisation** de l'objet + corps remplis (recalcul à la volée côté client).
- Bouton **Envoyer** → action → toast succès/erreur.
- **Historique des envois** (depuis `MailEnvoi`) : date, type, destinataire, statut.

## 8. Paramètres (ADMIN)

Section **"Modèles de mail"** :
- Liste par (scénario × type). Édition inline objet + corps (textarea), scénario, activation, réordonnancement, suppression.
- Encart listant les **variables disponibles** (`{civilite_nom}`, `{nom_client}`, `{filiale}`, `{adresse}`, `{date}`, `{creneau}`, `{numero_gc}`).

## 9. Seed

Les 6 mails du doc v3.5, avec crochets convertis en variables :
- `[Civilité Nom]` → `{civilite_nom}`, `[Nom du client]` → `{nom_client}`, `[date]` → `{date}`,
  `[créneau horaire]` → `{creneau}`, `[adresse du site]` → `{adresse}`, `[Numéro GC]` → `{numero_gc}`.
- 3 scénarios : "Centrex + FTTH — sur site", "Centrex — sur site (sans FTTH)", "Centrex — à distance".
- Chaque scénario : un PREVENANCE + un CONFIRMATION, contenu exact du doc.

## 10. Découpage (plan)

1. Prisma : `ModeleMail`, `MailEnvoi`, `TypeMail`, champ Client `creneauIntervention`, migration + seed des 6 mails.
2. Domaine substitution + tests.
3. Mailer nodemailer (env SMTP) + `.env.example`.
4. Repository mail + actions serveur (envoi + avancement étape).
5. Onglet "Mails" sur la fiche client (prévisualisation + envoi + historique).
6. Section Paramètres "Modèles de mail".
7. Vérif build + push.

## 11. Points ouverts

- Mapping scénario doc ↔ `Client.scenario` : non rigide. `ModeleMail.scenario` est un libellé libre ; l'opérateur choisit, avec suggestion auto si égalité. Ajustable en éditant les templates.
- Config SMTP fournie plus tard en env ; la feature se code et se teste (substitution, trace) sans envoi réel.
- `NUMERO_GC` en env (numéro de report affiché dans les mails).
