"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Hand,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopiePuce } from "@/components/CopiePuce";
import type { ChefProjetVue, DossierProjet } from "@/lib/repositories/chefProjetRepository";
import { estEtapeResolue } from "@/lib/domain/telephone/statuts";
import {
  attribuerProjetAction,
  cloreProjetAction,
  setCommentaireProjetAction,
  setSuiviProjetAction,
} from "./actions";

// Une URL ou un identifiant dans l'aide devient copiable : le chef de projet colle
// directement dans Sewan/UNYC sans re-saisir.
function Aide({ texte }: { texte: string }) {
  const url = texte.match(/https?:\/\/\S+/)?.[0];
  if (url) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span>{texte.replace(url, "").trim()}</span>
        <CopiePuce valeur={url} titre="URL d'autoprovision" />
      </span>
    );
  }
  return <span>{texte}</span>;
}

function SelectStatut({
  clientId,
  etapeId,
  statut,
  valeurs,
}: {
  clientId: string;
  etapeId: string;
  statut: string;
  valeurs: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const options = valeurs.includes(statut) ? valeurs : [statut, ...valeurs];
  return (
    <select
      value={statut}
      disabled={isPending}
      onChange={(e) => {
        const v = e.target.value;
        startTransition(async () => {
          await setSuiviProjetAction(clientId, etapeId, v);
        });
      }}
      className={cn(
        "w-32 cursor-pointer appearance-none rounded-full border border-transparent px-2.5 py-1 text-center text-xs font-semibold transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
        statut === "Fait" && "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
        statut === "En cours" && "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
        (statut === "Aucun" || statut === "Sans objet") &&
          "bg-[var(--pal-green-bg)]/40 text-muted-foreground",
        statut === "À faire" && "font-normal text-muted-foreground hover:border-input"
      )}
    >
      {options.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

function LigneEtape({
  dossier,
  etape,
  valeurs,
}: {
  dossier: DossierProjet;
  etape: ChefProjetVue["etapes"][number];
  valeurs: string[];
}) {
  const suivi = dossier.suivis[etape.id];
  const statut = suivi?.statut ?? "À faire";
  const [note, setNote] = useState(suivi?.commentaire ?? "");
  const [ouvertNote, setOuvertNote] = useState(false);
  const [, startTransition] = useTransition();
  const resolue = estEtapeResolue(statut);

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 border-t px-4 py-2 transition-colors",
        resolue ? "bg-[var(--pal-green-bg)]/15" : "hover:bg-[var(--ev-row-hover)]"
      )}
      style={{ borderColor: "var(--ev-row-border)" }}
    >
      <SelectStatut
        clientId={dossier.clientId}
        etapeId={etape.id}
        statut={statut}
        valeurs={valeurs}
      />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13px]", resolue ? "text-muted-foreground" : "font-medium")}>
          {etape.libelle}
        </div>
        {etape.aide && (
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">
            <Aide texte={etape.aide} />
          </div>
        )}
        {ouvertNote && (
          <input
            value={note}
            autoFocus
            placeholder="note pour l'équipe…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              setOuvertNote(false);
              if (note !== (suivi?.commentaire ?? ""))
                startTransition(async () => {
                  await setCommentaireProjetAction(dossier.clientId, etape.id, note);
                });
            }}
            className="mt-1 w-full max-w-lg rounded-md border border-input bg-transparent px-2 py-1 text-[12.5px] outline-none focus:border-ring"
          />
        )}
        {!ouvertNote && note && (
          <button
            onClick={() => setOuvertNote(true)}
            className="mt-1 text-left text-[11.5px] text-[color:var(--pal-amber-fg)] hover:underline"
          >
            {note}
          </button>
        )}
      </div>
      {!ouvertNote && !note && (
        <button
          onClick={() => setOuvertNote(true)}
          className="rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
          title="Ajouter une note"
        >
          <MessageSquare className="size-3" />
        </button>
      )}
    </div>
  );
}

function Dossier({
  dossier,
  vue,
  monEmail,
  ouvertParDefaut,
}: {
  dossier: DossierProjet;
  vue: ChefProjetVue;
  monEmail: string;
  ouvertParDefaut: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const [isPending, startTransition] = useTransition();
  const aMoi = dossier.attribueA === monEmail;
  const pris = !!dossier.attribueA;
  const complet = dossier.pourcentage === 100;

  const agir = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <section
      className="overflow-hidden rounded-xl border-2 bg-white"
      style={{
        borderColor: complet
          ? "color-mix(in oklab, var(--ev-green) 35%, white)"
          : "var(--ev-card-border)",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-2.5 px-4 py-2.5"
        style={{
          background: complet
            ? "color-mix(in oklab, var(--ev-green) 6%, white)"
            : "var(--ev-thead)",
        }}
      >
        <button onClick={() => setOuvert((o) => !o)} className="flex items-center gap-2">
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", !ouvert && "-rotate-90")}
          />
          <span className="text-[14px] font-bold tracking-tight">{dossier.raisonSociale}</span>
        </button>

        <Link
          href={`/clients/${dossier.clientId}`}
          className="text-[11px] text-muted-foreground hover:underline"
        >
          fiche
        </Link>

        {dossier.dateInterventionIso && (
          <span className="ev-badge bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">
            <CalendarClock className="size-2.5" />
            {new Date(dossier.dateInterventionIso).toLocaleDateString("fr-FR")}
            {dossier.creneau ? ` · ${dossier.creneau}` : ""}
          </span>
        )}
        {dossier.technicienNom && (
          <span className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]">
            {dossier.technicienNom}
          </span>
        )}
        {dossier.closLe && (
          <span className="ev-badge bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]">
            <CheckCircle2 className="size-2.5" />
            clos le {new Date(dossier.closLe).toLocaleDateString("fr-FR")}
          </span>
        )}

        {/* Avancement : barre + compteur, lisible sans déplier */}
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${dossier.pourcentage}%`,
                background: complet ? "var(--ev-green)" : "var(--ev-blue)",
              }}
            />
          </div>
          <span className="font-mono text-[11px] font-bold text-muted-foreground tabular-nums">
            {dossier.nbResolues}/{vue.etapes.length}
          </span>

          <button
            onClick={() => agir(() => attribuerProjetAction(dossier.clientId, !aMoi))}
            disabled={isPending || (pris && !aMoi)}
            className={cn(
              "ev-badge",
              aMoi
                ? "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]"
                : pris
                  ? "bg-muted text-muted-foreground"
                  : "border border-[color:var(--ev-card-border)] text-muted-foreground hover:bg-muted"
            )}
            title={
              aMoi
                ? "Vous pilotez ce dossier — cliquer pour le libérer"
                : pris
                  ? `Pris par ${dossier.attribueA}`
                  : "S'attribuer ce dossier"
            }
          >
            {aMoi ? <X className="size-2.5" /> : <Hand className="size-2.5" />}
            {aMoi ? "moi" : pris ? (dossier.attribueA ?? "").split("@")[0] : "prendre"}
          </button>

          <button
            onClick={() => agir(() => cloreProjetAction(dossier.clientId, !dossier.closLe))}
            disabled={isPending}
            className="rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
            title={dossier.closLe ? "Rouvrir la préparation" : "Clore la préparation"}
          >
            {dossier.closLe ? <RotateCcw className="size-3" /> : <CheckCircle2 className="size-3" />}
          </button>
        </div>
      </div>

      {ouvert &&
        vue.phases.map((phase) => (
          <div key={phase}>
            <div
              className="border-t px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--ev-accent-text)]"
              style={{ borderColor: "var(--ev-card-border-light)", background: "var(--ev-surface)" }}
            >
              {phase}
            </div>
            {vue.etapes
              .filter((e) => e.phase === phase)
              .map((e) => (
                <LigneEtape
                  key={e.id}
                  dossier={dossier}
                  etape={e}
                  valeurs={vue.valeursStatut}
                />
              ))}
          </div>
        ))}
    </section>
  );
}

export function ChecklistProjet({ vue, monEmail }: { vue: ChefProjetVue; monEmail: string }) {
  if (vue.dossiers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun dossier à préparer.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {vue.dossiers.map((d, i) => (
        // Seul le dossier le plus urgent est déplié : la liste reste lisible.
        <Dossier key={d.clientId} dossier={d} vue={vue} monEmail={monEmail} ouvertParDefaut={i === 0} />
      ))}
    </div>
  );
}
