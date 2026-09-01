"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Hand,
  Laptop,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopiePuce } from "@/components/CopiePuce";
import type { ChefProjetVue, DossierProjet } from "@/lib/repositories/chefProjetRepository";
import { estEtapeResolue } from "@/lib/domain/telephone/statuts";
import { nomCompte } from "@/lib/domain/comptes";
import { useEtatMemorise } from "@/components/useEtatMemorise";
import { estPanasonic, RESET_PANASONIC } from "@/lib/domain/projet/panasonic";
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

// Ce que le chef de projet a en face de lui : les postes du client, leur modèle, et l'URL
// d'autoprovision à coller dans chacun après reset. Un softphone n'a pas de fichier de
// configuration — c'est une installation sur le PC, signalée à part.
function PostesDossier({ dossier }: { dossier: DossierProjet }) {
  if (dossier.postes.length === 0) {
    return (
      <div
        className="border-t px-4 py-2 text-[11.5px] text-muted-foreground"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        Aucun équipement importé pour ce client.
      </div>
    );
  }

  // Les Panasonic remontent en premier : ce sont eux qui demandent un traitement à part
  // (reset au clavier, fichier d'autoprovision par poste).
  const postes = [...dossier.postes].sort(
    (a, b) => Number(estPanasonic(b.marque)) - Number(estPanasonic(a.marque))
  );
  const urlsPanasonic = postes.filter((p) => p.urlAutoprovision);

  return (
    <div className="border-t" style={{ borderColor: "var(--ev-card-border-light)" }}>
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--ev-accent-text)]"
        style={{ background: "var(--ev-surface)" }}
      >
        Postes
        <span className="font-mono">{dossier.postes.length}</span>
        {dossier.marques.map((m) => (
          <span
            key={m}
            className={cn(
              "ev-badge normal-case",
              estPanasonic(m)
                ? "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
                : "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]"
            )}
          >
            {m}
          </span>
        ))}
        {dossier.nbSoftphones > 0 && (
          <span
            className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)] normal-case"
            title="Softphones DOKO à réinstaller en Speek sur le poste de travail"
          >
            <Laptop className="size-2.5" />
            {dossier.nbSoftphones} Speek
          </span>
        )}
      </div>

      {/* Procédure de reset Panasonic : elle ne s'affiche que si le client en a. */}
      {dossier.aPanasonic && (
        <div
          className="border-t px-4 py-2.5"
          style={{ borderColor: "var(--ev-row-border)", background: "var(--pal-amber-bg)" }}
        >
          <div className="mb-1.5 text-[11px] font-bold text-[color:var(--pal-amber-fg)]">
            Reset d&apos;un poste Panasonic
          </div>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            {RESET_PANASONIC.map((etape, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[color:var(--pal-amber-fg)] font-mono text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{etape}</span>
                {i < RESET_PANASONIC.length - 1 && (
                  <span className="text-[color:var(--pal-amber-fg)]">›</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {postes.map((p, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5"
          style={{ borderColor: "var(--ev-row-border)" }}
        >
          <span className="w-40 truncate text-[12.5px]">{p.utilisateurNom ?? "—"}</span>
          <span
            className={cn(
              "w-44 truncate text-[12px]",
              estPanasonic(p.marque)
                ? "font-semibold text-[color:var(--pal-amber-fg)]"
                : "text-muted-foreground"
            )}
          >
            {p.modele ?? "—"}
          </span>
          {p.mac && <CopiePuce valeur={p.mac} titre="MAC" />}
          {p.softphone ? (
            <span className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]">
              <Laptop className="size-2.5" />
              Speek — installation sur le PC
            </span>
          ) : p.urlAutoprovision ? (
            <CopiePuce
              valeur={p.urlAutoprovision}
              libelle={`copier le .cfg de ce poste`}
              titre={p.urlAutoprovision}
            />
          ) : (
            <span className="text-[11px] text-muted-foreground">
              autoprovision par l&apos;URL générique
            </span>
          )}
        </div>
      ))}

      {urlsPanasonic.length > 1 && (
        <div className="border-t px-4 py-1.5" style={{ borderColor: "var(--ev-row-border)" }}>
          <CopiePuce
            valeur={urlsPanasonic.map((p) => p.urlAutoprovision).join("\n")}
            libelle={`copier les ${urlsPanasonic.length} .cfg Panasonic`}
            titre="Une URL par ligne, dans l'ordre des postes"
          />
        </div>
      )}
    </div>
  );
}

function Dossier({
  dossier,
  vue,
  monEmail,
  nomsComptes,
  ouvertParDefaut,
}: {
  dossier: DossierProjet;
  vue: ChefProjetVue;
  monEmail: string;
  nomsComptes: Record<string, string>;
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
                  ? `Pris par ${nomCompte(dossier.attribueA, nomsComptes)} (${dossier.attribueA})`
                  : "S'attribuer ce dossier"
            }
          >
            {aMoi ? <X className="size-2.5" /> : <Hand className="size-2.5" />}
            {aMoi ? "moi" : pris ? nomCompte(dossier.attribueA, nomsComptes) : "prendre"}
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

      {ouvert && <PostesDossier dossier={dossier} />}

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

export function ChecklistProjet({
  vue,
  monEmail,
  nomsComptes,
}: {
  vue: ChefProjetVue;
  monEmail: string;
  // email → nom saisi à la création du compte.
  nomsComptes: Record<string, string>;
}) {
  // Même organisation que l'onglet Téléphone : le chantier avance lot par lot, un seul lot
  // ouvert à la fois, et l'état d'ouverture survit à un aller-retour vers une fiche client.
  const [lotOuvert, setLotOuvert] = useEtatMemorise<string | null>("projet:lot-ouvert", null);

  if (vue.dossiers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun dossier à préparer.
      </p>
    );
  }

  const parLot = new Map<string, DossierProjet[]>();
  for (const d of vue.dossiers) {
    const cle = d.lotNom ?? "Sans lot";
    const liste = parLot.get(cle);
    if (liste) liste.push(d);
    else parLot.set(cle, [d]);
  }
  const lots = [...parLot.entries()].sort(([a], [b]) =>
    a === "Sans lot" ? 1 : b === "Sans lot" ? -1 : a.localeCompare(b, "fr", { numeric: true })
  );
  const lotUnique = lots.length === 1 ? lots[0][0] : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground tabular-nums">
        {lots.length} lot{lots.length > 1 ? "s" : ""} · {vue.dossiers.length} dossier
        {vue.dossiers.length > 1 ? "s" : ""} · cliquez une bande pour ouvrir
      </span>

      {lots.map(([lot, dossiers]) => {
        const ouvert = lotUnique === lot || lotOuvert === lot;
        const faits = dossiers.reduce((n, d) => n + d.nbResolues, 0);
        const total = dossiers.length * vue.etapes.length;
        const pct = total > 0 ? Math.round((faits / total) * 100) : 0;
        return (
          <div key={lot} className="flex flex-col gap-2">
            {lots.length > 1 && (
              <button
                onClick={() => setLotOuvert(ouvert ? null : lot)}
                className="flex items-center gap-2.5 rounded-xl border bg-card px-4 py-2.5 text-left shadow-xs hover:bg-[var(--ev-row-hover)]"
                style={{ borderColor: "var(--ev-card-border)" }}
              >
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    !ouvert && "-rotate-90"
                  )}
                />
                <span className="text-[14px] font-bold tracking-tight">{lot}</span>
                <span
                  className="h-[5px] w-24 overflow-hidden rounded-full"
                  style={{ background: "oklch(0.92 0.008 240)" }}
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      background: pct === 100 ? "var(--pal-green-dot)" : "var(--ev-blue)",
                      width: `${pct}%`,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "font-mono text-[11.5px] font-bold tabular-nums",
                    pct === 100
                      ? "text-[color:var(--pal-green-fg)]"
                      : "text-[color:var(--ev-accent-text)]"
                  )}
                >
                  {pct} %
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""}
                </span>
              </button>
            )}

            {ouvert &&
              dossiers.map((d, i) => (
                // Seul le dossier le plus urgent du lot est déplié : la liste reste lisible.
                <Dossier
                  key={d.clientId}
                  dossier={d}
                  vue={vue}
                  monEmail={monEmail}
                  nomsComptes={nomsComptes}
                  ouvertParDefaut={i === 0}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
