"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Hand,
  Info,
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

// Une étape sur une seule ligne : pastille d'état, libellé, aide en infobulle, statut et
// note. L'aide occupait auparavant une deuxième ligne sous chaque étape et doublait la
// hauteur de la checklist ; elle ne s'affiche plus qu'au survol de l'icône.
function LigneEtape({
  dossier,
  etape,
  valeurs,
  courante,
}: {
  dossier: DossierProjet;
  etape: ChefProjetVue["etapes"][number];
  valeurs: string[];
  /** Première étape non résolue du dossier : celle à faire maintenant. */
  courante: boolean;
}) {
  const suivi = dossier.suivis[etape.id];
  const statut = suivi?.statut ?? "À faire";
  const [note, setNote] = useState(suivi?.commentaire ?? "");
  const [ouvertNote, setOuvertNote] = useState(false);
  const [, startTransition] = useTransition();
  const resolue = estEtapeResolue(statut);
  const url = etape.aide?.match(/https?:\/\/\S+/)?.[0] ?? null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1.5 transition-colors",
        resolue && "opacity-60",
        courante && "bg-[var(--pal-blue-bg)]/40"
      )}
      style={{ borderColor: "var(--ev-row-border)" }}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          resolue
            ? "bg-[color:var(--pal-green-fg)]"
            : statut === "En cours"
              ? "bg-[color:var(--pal-amber-fg)]"
              : "bg-[color:var(--ev-card-border)]"
        )}
        title={statut}
      />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          resolue ? "text-muted-foreground line-through" : courante && "font-semibold"
        )}
        title={etape.libelle}
      >
        {etape.libelle}
      </span>

      {etape.aide && (
        <span
          className="shrink-0 cursor-help text-muted-foreground"
          title={etape.aide}
          aria-label={etape.aide}
        >
          <Info className="size-3.5" />
        </span>
      )}
      {url && <CopiePuce valeur={url} libelle="URL" titre={url} />}

      <SelectStatut
        clientId={dossier.clientId}
        etapeId={etape.id}
        statut={statut}
        valeurs={valeurs}
      />

      {ouvertNote ? (
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
          className="w-56 rounded-md border border-input bg-transparent px-2 py-0.5 text-[12px] outline-none focus:border-ring"
        />
      ) : note ? (
        <button
          onClick={() => setOuvertNote(true)}
          className="max-w-56 truncate text-left text-[11.5px] text-[color:var(--pal-amber-fg)] hover:underline"
          title={note}
        >
          {note}
        </button>
      ) : (
        <button
          onClick={() => setOuvertNote(true)}
          className="shrink-0 rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
          title="Ajouter une note"
        >
          <MessageSquare className="size-3" />
        </button>
      )}
    </div>
  );
}

// Corps d'un dossier ouvert : la checklist à gauche, les postes à droite en colonne fixe.
// Une seule phase est visible à la fois — les treize étapes empilées obligeaient à faire
// défiler sans fin, alors qu'on travaille phase par phase. Les onglets portent l'avancement
// de chaque phase, et celle qui reste à traiter s'ouvre d'office.
function CorpsDossier({ dossier, vue }: { dossier: DossierProjet; vue: ChefProjetVue }) {
  const parPhase = vue.phases.map((phase) => {
    const etapes = vue.etapes.filter((e) => e.phase === phase);
    const faites = etapes.filter((e) => estEtapeResolue(dossier.suivis[e.id]?.statut)).length;
    return { phase, etapes, faites, total: etapes.length };
  });
  const premiereNonFinie = parPhase.find((p) => p.faites < p.total)?.phase ?? vue.phases[0];
  const [phaseActive, setPhaseActive] = useState(premiereNonFinie);

  // Étape à faire maintenant : la première non résolue de tout le dossier.
  const courante = vue.etapes.find((e) => !estEtapeResolue(dossier.suivis[e.id]?.statut));
  const active = parPhase.find((p) => p.phase === phaseActive) ?? parPhase[0];

  return (
    <div className="grid gap-0 border-t lg:grid-cols-[1fr_330px]" style={{ borderColor: "var(--ev-card-border-light)" }}>
      <div className="min-w-0">
        {/* Onglets de phase, avec l'avancement de chacune */}
        <div
          className="flex flex-wrap gap-1 px-3 py-2"
          style={{ background: "var(--ev-surface)" }}
        >
          {parPhase.map((p) => {
            const complete = p.faites === p.total;
            const actif = p.phase === phaseActive;
            return (
              <button
                key={p.phase}
                onClick={() => setPhaseActive(p.phase)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  actif
                    ? "bg-white shadow-xs ring-1 ring-[color:var(--ev-card-border)]"
                    : "text-muted-foreground hover:bg-white/60"
                )}
              >
                {complete && <CheckCircle2 className="size-3 text-[color:var(--pal-green-fg)]" />}
                {p.phase}
                <span
                  className={cn(
                    "font-mono text-[10.5px]",
                    complete ? "text-[color:var(--pal-green-fg)]" : "text-muted-foreground"
                  )}
                >
                  {p.faites}/{p.total}
                </span>
              </button>
            );
          })}
        </div>

        {active.etapes.map((e) => (
          <LigneEtape
            key={e.id}
            dossier={dossier}
            etape={e}
            valeurs={vue.valeursStatut}
            courante={e.id === courante?.id}
          />
        ))}
      </div>

      {/* Postes : colonne latérale, visible pendant qu'on déroule les étapes */}
      <div
        className="border-t lg:border-t-0 lg:border-l"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        <PostesDossier dossier={dossier} />
      </div>
    </div>
  );
}

function PostesDossier({ dossier }: { dossier: DossierProjet }) {
  if (dossier.postes.length === 0) {
    return (
      <div className="px-3 py-3 text-[11.5px] text-muted-foreground">
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
    <div className="lg:sticky lg:top-0">
      <div
        className="flex flex-wrap items-center gap-2 px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--ev-accent-text)]"
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
          className="border-t px-3 py-2"
          style={{ borderColor: "var(--ev-row-border)", background: "var(--pal-amber-bg)" }}
        >
          <div className="mb-1.5 text-[11px] font-bold text-[color:var(--pal-amber-fg)]">
            Reset d&apos;un poste Panasonic
          </div>
          <ol className="flex flex-col gap-1 text-[11.5px]">
            {RESET_PANASONIC.map((etape, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[color:var(--pal-amber-fg)] font-mono text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{etape}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {postes.map((p, i) => (
        <div
          key={i}
          className="flex flex-col gap-1 border-t px-3 py-2"
          style={{ borderColor: "var(--ev-row-border)" }}
        >
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[12.5px] font-medium",
                estPanasonic(p.marque) && "text-[color:var(--pal-amber-fg)]"
              )}
              title={p.modele ?? undefined}
            >
              {p.modele ?? "—"}
            </span>
            <span className="shrink-0 truncate text-[11px] text-muted-foreground">
              {p.utilisateurNom ?? "—"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
            <span className="text-[11px] text-muted-foreground">URL générique</span>
          )}
          </div>
        </div>
      ))}

      {urlsPanasonic.length > 1 && (
        <div className="border-t px-3 py-2" style={{ borderColor: "var(--ev-row-border)" }}>
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

      {ouvert && <CorpsDossier dossier={dossier} vue={vue} />}
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
