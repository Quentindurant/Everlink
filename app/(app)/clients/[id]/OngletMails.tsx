"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, PenLine, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { contactSite, substituer, type VariablesMail } from "@/lib/domain/mail/substitution";
import type { ModeleMailLite } from "@/lib/repositories/mailRepository";
import { SUIVI_MAIL } from "@/lib/domain/mail/suiviStatuts";
import { blocGuidesSpeek, blocPreparationSpeek } from "@/lib/domain/mail/softphone";
import { envoyerMailAction, setCreneauInterventionAction } from "./mailActions";

export interface EnvoiLigne {
  id: string;
  type: string;
  destinataire: string;
  objet: string;
  corps: string;
  succes: boolean;
  erreur: string | null;
  creeLe: string;
  auteurEmail: string | null;
  // Délivrabilité Mailjet (sent/opened/bounce…), relevée par le cron mail-suivi.
  suiviStatut: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  PREVENANCE: "Prévenance",
  RELANCE: "Relance",
  CONFIRMATION: "Confirmation RDV",
};

// Badge d'état d'un envoi : échec SMTP en rouge, sinon délivrabilité Mailjet
// (Livré/Ouvert vert, En file/Différé bleu, Rejeté/Bloqué/Spam rouge).
function BadgeEnvoi({ e }: { e: EnvoiLigne }) {
  if (!e.succes) {
    return (
      <span
        className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive"
        title={e.erreur ?? undefined}
      >
        Échec
      </span>
    );
  }
  const suivi = e.suiviStatut ? SUIVI_MAIL[e.suiviStatut] : null;
  const classes =
    suivi?.niveau === "erreur"
      ? "bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]"
      : suivi?.niveau === "info"
        ? "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]"
        : "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {suivi?.libelle ?? "Envoyé"}
    </span>
  );
}

// Ligne de champ façon Gmail : libellé discret à gauche, saisie sans cadre, filet en bas.
function LigneChamp({
  libelle,
  children,
}: {
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 border-b px-4 py-1.5"
      style={{ borderColor: "var(--ev-card-border-light)" }}
    >
      <span className="w-14 shrink-0 text-[12px] text-muted-foreground">{libelle}</span>
      {children}
    </div>
  );
}

export function OngletMails({
  clientInfo,
  modeles,
  envois,
  numeroGc,
  nbSoftphones,
  nomsGuides,
  mailMigration,
}: {
  clientInfo: {
    id: string;
    scenario: string | null;
    raisonSociale: string;
    filiale: string | null;
    adresse: string | null;
    contactNom: string | null;
    contactPrenom: string | null;
    contactEmail: string | null;
    contactFixe: string | null;
    contactMobile: string | null;
    dateIso: string | null;
    creneau: string | null;
  };
  modeles: ModeleMailLite[];
  envois: EnvoiLigne[];
  numeroGc: string;
  // Boîte mail de migration de la filiale, à laquelle le client répond.
  mailMigration: string;
  // Utilisateurs à migrer de DOKO vers Speek : declenche le paragraphe de preparation.
  nbSoftphones: number;
  // Guides joints automatiquement a la confirmation quand il y a des softphones.
  nomsGuides: string[];
}) {
  // Défaut: 1er template dont le scénario matche celui du client, sinon le 1er.
  const modeleParDefaut =
    modeles.find((m) => m.scenario === clientInfo.scenario)?.id ?? modeles[0]?.id ?? "";
  const [modeleId, setModeleId] = useState(modeleParDefaut);
  const [destinataire, setDestinataire] = useState(clientInfo.contactEmail ?? "");
  const [date, setDate] = useState(clientInfo.dateIso ?? "");
  const [creneau, setCreneau] = useState(clientInfo.creneau ?? "");
  // null = suit le modèle (avec variables à jour) ; string = texte retouché à la main.
  const [objetEdite, setObjetEdite] = useState<string | null>(null);
  const [corpsEdite, setCorpsEdite] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const modele = modeles.find((m) => m.id === modeleId) ?? null;

  const variables: Partial<VariablesMail> = useMemo(() => {
    const civ = [clientInfo.contactPrenom, clientInfo.contactNom].filter(Boolean).join(" ").trim();
    return {
      civilite_nom: civ || "Madame, Monsieur",
      nom_client: clientInfo.raisonSociale,
      filiale: clientInfo.filiale ?? "",
      adresse: clientInfo.adresse ?? "",
      date: date ? new Date(date).toLocaleDateString("fr-FR") : "",
      creneau,
      numero_gc: numeroGc,
      mail_migration: mailMigration,
      contact_site: contactSite(clientInfo),
    };
  }, [clientInfo, date, creneau, numeroGc, mailMigration]);

  const objetModele = modele ? substituer(modele.objet, variables) : "";
  // Softphones à réinstaller : la prévenance demande la préparation, la confirmation
  // annonce les guides joints. Ajouté au corps proposé, donc modifiable avant envoi.
  const complementSoftphone =
    nbSoftphones === 0 || !modele
      ? ""
      : modele.type === "PREVENANCE"
        ? `\n\n${blocPreparationSpeek(nbSoftphones)}`
        : modele.type === "CONFIRMATION"
          ? `\n\n${blocGuidesSpeek(nomsGuides.length)}`.trimEnd()
          : "";
  const corpsModele = modele
    ? substituer(modele.corps, variables) + complementSoftphone
    : "";
  const objet = objetEdite ?? objetModele;
  const corps = corpsEdite ?? corpsModele;
  const retouche = objetEdite !== null || corpsEdite !== null;

  const changerModele = (id: string) => {
    setModeleId(id);
    // Nouveau modèle = nouveau texte : on abandonne les retouches de l'ancien.
    setObjetEdite(null);
    setCorpsEdite(null);
  };

  const envoyer = () => {
    if (!modele) return;
    setMessage(null);
    startTransition(async () => {
      // Persiste date/créneau saisis, puis envoie le contenu tel qu'affiché (retouches incluses).
      await setCreneauInterventionAction(clientInfo.id, date, creneau);
      const r = await envoyerMailAction(clientInfo.id, modele.type, destinataire, objet, corps);
      setMessage(
        r.success
          ? { ok: true, texte: "Mail envoyé et étape avancée." }
          : { ok: false, texte: r.error ?? "Échec de l'envoi." }
      );
    });
  };

  if (modeles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Aucun modèle de mail. Créez-en dans Paramètres.
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_1fr]">
      {/* Composeur façon Gmail : tout est éditable avant l'envoi. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{ background: "var(--ev-thead)", borderColor: "var(--ev-card-border-light)" }}
        >
          <PenLine className="size-3.5 text-muted-foreground" />
          <span className="text-[13px] font-bold">Nouveau message</span>
          {retouche && (
            <button
              onClick={() => {
                setObjetEdite(null);
                setCorpsEdite(null);
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              title="Abandonner les retouches et revenir au texte du modèle"
            >
              <RotateCcw className="size-3" />
              texte du modèle
            </button>
          )}
        </div>

        <LigneChamp libelle="Modèle">
          <select
            value={modeleId}
            onChange={(e) => changerModele(e.target.value)}
            className="w-full bg-transparent py-1 text-sm outline-none"
          >
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>
                {TYPE_LABEL[m.type] ?? m.type} — {m.scenario}
              </option>
            ))}
          </select>
        </LigneChamp>

        <LigneChamp libelle="À">
          <input
            type="email"
            value={destinataire}
            onChange={(e) => setDestinataire(e.target.value)}
            placeholder="contact@client.fr"
            className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </LigneChamp>

        <LigneChamp libelle="Objet">
          <input
            value={objet}
            onChange={(e) => setObjetEdite(e.target.value)}
            className="w-full bg-transparent py-1 text-sm font-medium outline-none"
          />
        </LigneChamp>

        <textarea
          value={corps}
          onChange={(e) => setCorpsEdite(e.target.value)}
          spellCheck={false}
          className="block min-h-[380px] w-full resize-y bg-transparent px-4 py-3 text-[13.5px] leading-relaxed outline-none"
        />
        <p className="px-4 pb-2 text-[10.5px] text-muted-foreground">
          La signature EverLink (logo Pôle migration) est ajoutée automatiquement à l&apos;envoi.
        </p>

        {/* Softphones : ce que l'envoi va ajouter, visible avant de cliquer. */}
        {nbSoftphones > 0 && modele && (modele.type === "PREVENANCE" || modele.type === "CONFIRMATION") && (
          <div
            className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-[11.5px]"
            style={{ borderColor: "var(--ev-card-border-light)", background: "var(--pal-violet-bg)" }}
          >
            <span className="font-semibold text-[color:var(--pal-violet-fg)]">
              {nbSoftphones} poste{nbSoftphones > 1 ? "s" : ""} DOKO → Speek
            </span>
            <span className="text-muted-foreground">
              {modele.type === "PREVENANCE"
                ? "demande de préinstallation ajoutée au message"
                : nomsGuides.length > 0
                  ? `guide${nomsGuides.length > 1 ? "s" : ""} joint${nomsGuides.length > 1 ? "s" : ""} : ${nomsGuides.join(", ")}`
                  : "aucun guide dans public/guides/speek — rien ne sera joint"}
            </span>
          </div>
        )}

        {/* Barre d'envoi : date/créneau alimentent les variables du modèle. */}
        <div
          className="flex flex-wrap items-center gap-3 border-t px-4 py-3"
          style={{ borderColor: "var(--ev-card-border-light)" }}
        >
          <Button onClick={envoyer} disabled={isPending || !destinataire.trim()}>
            <Send data-icon="inline-start" />
            {isPending ? "Envoi…" : "Envoyer"}
          </Button>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Date
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-sm" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Créneau
            <Input value={creneau} onChange={(e) => setCreneau(e.target.value)} placeholder="9h-13h" className="h-8 w-24 text-sm" />
          </label>
          {message && (
            <span className={cn("text-sm", message.ok ? "text-[color:var(--pal-green-fg)]" : "text-destructive")}>
              {message.texte}
            </span>
          )}
        </div>
      </div>

      {/* Boîte d'envoi façon Gmail : une ligne par mail, clic pour lire le message. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <p
          className="border-b px-4 py-2.5 text-[13px] font-bold"
          style={{ background: "var(--ev-thead)", borderColor: "var(--ev-card-border-light)" }}
        >
          Messages envoyés
          <span className="ml-1.5 font-mono text-[11px] font-bold text-muted-foreground">
            {envois.length}
          </span>
        </p>
        {envois.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun mail envoyé.</p>
        ) : (
          <div className="max-h-[560px] overflow-auto">
            {envois.map((e) => {
              const ouvert = lectureId === e.id;
              return (
                <div
                  key={e.id}
                  className="border-t first:border-t-0"
                  style={{ borderColor: "var(--ev-row-border)" }}
                >
                  <button
                    onClick={() => setLectureId(ouvert ? null : e.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors",
                      ouvert ? "bg-[var(--pal-blue-bg)]/40" : "hover:bg-[var(--ev-row-hover)]"
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        !ouvert && "-rotate-90"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold">{e.destinataire}</span>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">
                          {TYPE_LABEL[e.type] ?? e.type}
                        </span>
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">{e.objet}</div>
                    </div>
                    <BadgeEnvoi e={e} />
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums">
                      {e.creeLe}
                    </span>
                  </button>

                  {/* Lecture du message tel qu'envoyé */}
                  {ouvert && (
                    <div className="px-4 pb-3">
                      <div
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--ev-card-border-light)" }}
                      >
                        <div className="mb-2 text-[13px] font-semibold">{e.objet}</div>
                        <pre className="max-h-72 overflow-auto text-[12.5px] leading-relaxed whitespace-pre-wrap">
                          {e.corps || "—"}
                        </pre>
                        <div className="mt-2 flex flex-wrap gap-x-4 text-[10.5px] text-muted-foreground">
                          <span>envoyé par {e.auteurEmail ?? "—"}</span>
                          {e.erreur && <span className="text-destructive">{e.erreur}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
