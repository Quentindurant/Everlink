"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronDown,
  Hand,
  Laptop,
  Lock,
  LockOpen,
  MapPin,
  ShieldAlert,
  TrafficCone,
  X,
} from "lucide-react";
import { CopiePuce } from "@/components/CopiePuce";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TelephoneGrille as Grille } from "@/lib/repositories/telephoneRepository";
import { estEtapeResolue } from "@/lib/domain/telephone/statuts";
import { nomCompte } from "@/lib/domain/comptes";
import { useEtatMemorise } from "@/components/useEtatMemorise";
import {
  affecterSiteAction,
  affecterSiteRestantsAction,
  bloquerClientAction,
  debloquerClientAction,
  attribuerClientTelephoneAction,
  setEtapeClientAction,
  setSuiviEtapeAction,
} from "./actions";

function CelluleStatut({
  utilisateurId,
  etapeId,
  statut,
  valeurs,
}: {
  utilisateurId: string;
  etapeId: string;
  statut: string;
  valeurs: string[];
}) {
  const [isPending, startTransition] = useTransition();
  // Valeur historique désactivée: on la garde dans les options, marquée obsolète (SPEC §8).
  const options = valeurs.includes(statut) ? valeurs : [statut, ...valeurs];

  // Pastille colorée par état : le regard scanne la grille sans lire chaque cellule.
  // "À faire" reste volontairement discret (c'est l'état par défaut, il ne doit pas crier).
  return (
    <select
      value={statut}
      disabled={isPending}
      onChange={(e) => {
        const valeur = e.target.value;
        startTransition(async () => {
          await setSuiviEtapeAction(utilisateurId, etapeId, valeur);
        });
      }}
      className={cn(
        "w-full cursor-pointer appearance-none rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
        statut === "Fait" &&
          "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
        statut === "En cours" &&
          "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
        // « Aucun » / « Sans objet » : résolu mais discret — teinte verte pâle barrée de gris.
        (statut === "Aucun" || statut === "Sans objet") &&
          "bg-[var(--pal-green-bg)]/40 text-muted-foreground",
        statut === "À faire" && "font-normal text-muted-foreground hover:border-input"
      )}
    >
      {options.map((v) => (
        <option key={v} value={v}>
          {v}
          {!valeurs.includes(v) ? " (obsolète)" : ""}
        </option>
      ))}
    </select>
  );
}

function MenuEtapeClient({
  clientId,
  etapes,
  valeurs,
}: {
  clientId: string;
  etapes: { id: string; libelle: string }[];
  valeurs: string[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="xs" disabled={isPending}>
            Toute une étape
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-96 overflow-y-auto">
        {etapes.map((e) =>
          valeurs.map((v) => (
            <DropdownMenuItem
              key={`${e.id}:${v}`}
              onClick={() =>
                startTransition(async () => {
                  await setEtapeClientAction(clientId, e.id, v);
                })
              }
            >
              {e.libelle} → {v}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Attribution du client à un tech : badge « à moi » / « pris par X », bouton pour prendre
// ou libérer. Évite que deux techniciens configurent le même client en parallèle.
function AttributionClient({
  clientId,
  attribueA,
  monEmail,
  nomsComptes,
}: {
  clientId: string;
  attribueA: string | null;
  monEmail: string;
  nomsComptes: Record<string, string>;
}) {
  const [isPending, startTransition] = useTransition();
  const agir = (prendre: boolean) =>
    startTransition(async () => {
      await attribuerClientTelephoneAction(clientId, prendre);
    });


  if (!attribueA) {
    return (
      <Button
        variant="outline"
        size="xs"
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          agir(true);
        }}
      >
        <Hand data-icon="inline-start" />
        Je le prends
      </Button>
    );
  }
  const aMoi = attribueA === monEmail;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        aMoi
          ? "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
          : "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
      )}
      title={aMoi ? "Ce client vous est attribué" : `Attribué à ${nomCompte(attribueA, nomsComptes)} (${attribueA})`}
    >
      <Hand className="size-2.5" />
      {aMoi ? "à moi" : nomCompte(attribueA, nomsComptes)}
      <button
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          if (
            aMoi ||
            window.confirm(`Client attribué à ${nomCompte(attribueA, nomsComptes)}. Le libérer ?`)
          )
            agir(false);
        }}
        className="ml-0.5 rounded-full hover:bg-black/10"
        title={aMoi ? "Libérer le client" : "Libérer (attribué à un autre tech)"}
      >
        <X className="size-2.5" />
      </button>
    </span>
  );
}

// Site du poste, pour un client à plusieurs adresses : le tech doit savoir où va chaque
// téléphone (les interventions sont datées site par site). Non renseigné = ambre, ça se voit.
function SitePoste({
  utilisateurId,
  siteId,
  sites,
}: {
  utilisateurId: string;
  siteId: string | null;
  sites: { id: string; nom: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={siteId ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const v = e.target.value;
        startTransition(async () => {
          await affecterSiteAction(utilisateurId, v);
        });
      }}
      title="Site de ce poste"
      className={cn(
        "cursor-pointer appearance-none rounded-full border border-transparent px-2 py-0.5 text-[10.5px] font-semibold outline-none focus:border-ring disabled:opacity-50",
        siteId
          ? "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
          : "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
      )}
    >
      <option value="">site ?</option>
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nom}
        </option>
      ))}
    </select>
  );
}

// Répartition des postes du client entre ses sites + affectation en masse de ceux qui
// n'en ont pas encore (après un import Sewan, aucun poste n'a de site).
function SitesClientBande({
  clientId,
  sites,
  rows,
}: {
  clientId: string;
  sites: { id: string; nom: string }[];
  rows: { siteId: string | null }[];
}) {
  const [isPending, startTransition] = useTransition();
  const sansSite = rows.filter((r) => !r.siteId).length;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {sites.map((s) => (
        <span
          key={s.id}
          className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
        >
          <MapPin className="size-2.5" />
          {s.nom}
          <span className="font-mono">{rows.filter((r) => r.siteId === s.id).length}</span>
        </span>
      ))}
      {sansSite > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                disabled={isPending}
                onClick={(e) => e.stopPropagation()}
                className="ev-badge bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)] hover:cursor-pointer"
                title="Affecter les postes sans site"
              >
                {sansSite} sans site
                <ChevronDown className="size-2.5" />
              </button>
            }
          />
          <DropdownMenuContent>
            {sites.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() =>
                  startTransition(async () => {
                    await affecterSiteRestantsAction(clientId, s.id);
                  })
                }
              >
                Tout affecter à « {s.nom} »
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

// Met le dossier en pause ou le relance. Un dossier bloqué reste visible — on doit savoir
// qu'il existe et pourquoi il n'avance pas — mais sa bande passe en gris barré.
function BlocageClient({
  clientId,
  bloque,
  motif,
}: {
  clientId: string;
  bloque: boolean;
  motif: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saisie, setSaisie] = useState(false);
  const [texte, setTexte] = useState("");

  if (bloque) {
    return (
      <button
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          startTransition(async () => {
            await debloquerClientAction(clientId);
          });
        }}
        className="ev-badge bg-[var(--pal-gray-bg,var(--ev-thead))] text-muted-foreground hover:cursor-pointer"
        title={motif ? `Bloqué : ${motif} — cliquer pour débloquer` : "Cliquer pour débloquer"}
      >
        <Lock className="size-2.5" />
        bloqué
      </button>
    );
  }

  if (saisie) {
    return (
      <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
        <input
          value={texte}
          autoFocus
          placeholder="motif du blocage…"
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSaisie(false);
            if (e.key === "Enter") {
              setSaisie(false);
              startTransition(async () => {
                await bloquerClientAction(clientId, texte);
              });
            }
          }}
          onBlur={() => setSaisie(false)}
          className="w-44 rounded-md border border-input bg-white px-1.5 py-0.5 text-[11.5px] outline-none focus:border-ring"
        />
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setSaisie(true);
      }}
      className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity group-hover/bande:opacity-100 hover:bg-muted"
      title="Mettre ce dossier en pause"
    >
      <LockOpen className="size-3" />
    </button>
  );
}

export function TelephoneGrille({
  grille,
  monEmail,
  nomsComptes,
}: {
  grille: Grille;
  monEmail: string;
  // email → nom saisi à la création du compte, pour afficher un nom et pas un identifiant.
  nomsComptes: Record<string, string>;
}) {
  const { etapes, utilisateurs, valeursStatut, sitesParClient } = grille;
  // Bandes clients repliées par défaut (comme le Provisionning) : on ouvre le client
  // qu'on travaille, la grille reste légère.
  // Mémorisés dans l'onglet : un aller-retour vers une fiche client ne referme rien.
  const [deplies, setDeplies] = useEtatMemorise<Set<string>>(
    "tel:clients-deplies",
    new Set(),
    (brut) => new Set(Array.isArray(brut) ? (brut as string[]) : [])
  );
  // Le chantier avance lot par lot : un seul lot ouvert à la fois.
  const [lotOuvert, setLotOuvert] = useEtatMemorise<string | null>("tel:lot-ouvert", null);
  const basculerRepli = (raisonSociale: string) =>
    setDeplies((prev) => {
      const n = new Set(prev);
      if (n.has(raisonSociale)) n.delete(raisonSociale);
      else n.add(raisonSociale);
      return n;
    });

  if (utilisateurs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucun utilisateur. Ajustez les filtres ou importez des données.
      </div>
    );
  }

  const groupes = new Map<string, typeof utilisateurs>();
  for (const u of utilisateurs) {
    const liste = groupes.get(u.clientRaisonSociale);
    if (liste) liste.push(u);
    else groupes.set(u.clientRaisonSociale, [u]);
  }

  // Niveau lot au-dessus des clients, dans l'ordre des noms ; « Sans lot » en dernier.
  const parLot = new Map<string, [string, typeof utilisateurs][]>();
  for (const [raisonSociale, rows] of groupes) {
    const cle = rows[0].clientLotNom ?? "Sans lot";
    const liste = parLot.get(cle);
    if (liste) liste.push([raisonSociale, rows]);
    else parLot.set(cle, [[raisonSociale, rows]]);
  }
  const lots = [...parLot.entries()].sort(([a], [b]) =>
    a === "Sans lot" ? 1 : b === "Sans lot" ? -1 : a.localeCompare(b, "fr", { numeric: true })
  );

  const nbColonnes = etapes.length + 1;
  const toutDeplie = deplies.size >= groupes.size && groupes.size > 0;
  // Un seul lot : l'ouvrir d'office, la hiérarchie n'apporterait rien.
  const lotUnique = lots.length === 1 ? lots[0][0] : null;

  // Avancement d'un ensemble de clients, en cases d'étapes résolues.
  const avancement = (clients: [string, typeof utilisateurs][]) => {
    const rows = clients.flatMap(([, r]) => r);
    const total = rows.length * etapes.length;
    const faits = rows.reduce(
      (acc, u) => acc + etapes.filter((e) => estEtapeResolue(u.statuts[e.id])).length,
      0
    );
    return { pct: total > 0 ? Math.round((faits / total) * 100) : 0, nbPostes: rows.length };
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {lots.length} lot{lots.length > 1 ? "s" : ""} · {groupes.size} client
          {groupes.size > 1 ? "s" : ""} · cliquez une bande pour ouvrir
        </span>
        <button
          onClick={() => setDeplies(toutDeplie ? new Set() : new Set(groupes.keys()))}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {toutDeplie ? "Tout replier" : "Tout déplier"}
        </button>
      </div>
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-auto py-2 whitespace-nowrap align-bottom">
              Utilisateur
            </TableHead>
            {etapes.map((e) => (
              <TableHead
                key={e.id}
                className="h-auto max-w-40 min-w-28 py-2 leading-[1.3] whitespace-normal align-bottom"
                title={e.libelle}
              >
                {e.libelle}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map(([lot, clientsDuLot]) => {
            const lotDeplie = toutDeplie || lotUnique === lot || lotOuvert === lot;
            const { pct: pctLot, nbPostes } = avancement(clientsDuLot);
            return (
              <Fragment key={lot}>
                {lots.length > 1 && (
                  <TableRow
                    className="cursor-pointer hover:bg-[var(--ev-row-hover)]"
                    style={{ background: "var(--ev-surface)" }}
                    onClick={() => setLotOuvert(lotDeplie ? null : lot)}
                  >
                    <TableCell colSpan={nbColonnes} className="py-2">
                      <span className="flex items-center gap-2.5">
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            !lotDeplie && "-rotate-90"
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
                              background: pctLot === 100 ? "var(--pal-green-dot)" : "var(--ev-blue)",
                              width: `${pctLot}%`,
                            }}
                          />
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[11.5px] font-bold tabular-nums",
                            pctLot === 100
                              ? "text-[color:var(--pal-green-fg)]"
                              : "text-[color:var(--ev-accent-text)]"
                          )}
                        >
                          {pctLot} %
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {clientsDuLot.length} client{clientsDuLot.length > 1 ? "s" : ""} ·{" "}
                          {nbPostes} poste{nbPostes > 1 ? "s" : ""}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {lotDeplie &&
                  clientsDuLot.map(([raisonSociale, rows]) => {
            const clientId = rows[0].clientId;
            const ouvert = deplies.has(raisonSociale);
            const total = rows.length * etapes.length;
            const faits = rows.reduce(
              (acc, u) =>
                acc + etapes.filter((e) => estEtapeResolue(u.statuts[e.id])).length,
              0
            );
            const pct = total > 0 ? Math.round((faits / total) * 100) : 0;
            return (
              <Fragment key={raisonSociale}>
                <TableRow
                  className={cn(
                    "group/bande cursor-pointer hover:bg-[var(--ev-row-hover)]",
                    rows[0].clientBloque
                      ? "bg-[var(--pal-gray-bg,#f1f3f5)] opacity-70"
                      : !rows[0].migrable
                        ? "bg-[var(--pal-red-bg)]/30"
                        : "bg-[var(--ev-thead)]"
                  )}
                  onClick={() => basculerRepli(raisonSociale)}
                >
                  <TableCell colSpan={nbColonnes} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5">
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground transition-transform",
                            !ouvert && "-rotate-90"
                          )}
                        />
                        <Link
                          href={`/clients/${clientId}`}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "text-[13.5px] font-bold hover:underline",
                            rows[0].clientBloque && "text-muted-foreground line-through"
                          )}
                        >
                          {raisonSociale}
                        </Link>
                        {rows[0].migrable ? (
                          <span
                            className="ev-badge bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
                            title={
                              rows[0].migrableRaison === "statut_adv"
                                ? "Les ADV ont posé le statut INSTALLATION : migration ouverte"
                                : "Intervention dans 3 jours ou moins : migration ouverte"
                            }
                          >
                            à migrer
                          </span>
                        ) : (
                          <span
                            className="ev-badge bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]"
                            title={
                              "Ne pas préconfigurer : cela casse la joignabilité du client chez Sewan. " +
                              "La migration s'ouvre au statut INSTALLATION posé par les ADV, ou à 3 jours de l'intervention."
                            }
                          >
                            <TrafficCone className="size-2.5" />
                            {rows[0].joursAvantMigration !== null
                              ? `pas avant J-3 · dans ${rows[0].joursAvantMigration} j`
                              : "pas encore planifié"}
                          </span>
                        )}
                        <BlocageClient
                          clientId={clientId}
                          bloque={rows[0].clientBloque}
                          motif={rows[0].clientBloqueMotif}
                        />
                        {rows[0].prestatairesTotal > 0 && (
                          <Link
                            href={`/clients/${clientId}`}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "ev-badge",
                              rows[0].prestatairesATraiter > 0
                                ? "bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]"
                                : "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
                            )}
                            title={
                              rows[0].prestatairesATraiter > 0
                                ? "Prestataires externes à joindre avant l'intervention"
                                : "Tous les prestataires externes ont été traités"
                            }
                          >
                            <ShieldAlert className="size-2.5" />
                            {rows[0].prestatairesATraiter > 0
                              ? `${rows[0].prestatairesATraiter} prestataire${rows[0].prestatairesATraiter > 1 ? "s" : ""}`
                              : "prestataires OK"}
                          </Link>
                        )}
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
                        {rows[0].clientDateIso ? (
                          <span
                            className="ev-badge bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]"
                            title="Date d'installation planifiée"
                          >
                            <CalendarClock className="size-2.5" />
                            {new Date(rows[0].clientDateIso).toLocaleDateString("fr-FR")}
                            {rows[0].clientCreneau ? ` · ${rows[0].clientCreneau}` : ""}
                          </span>
                        ) : (
                          <span className="ev-badge bg-muted text-muted-foreground" title="Aucune date d'installation planifiée">
                            <CalendarClock className="size-2.5" />
                            à planifier
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {rows.length} utilisateur{rows.length > 1 ? "s" : ""}
                        </span>
                        {rows.some((u) => u.softphone) && (
                          <span
                            className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
                            title="Postes avec softphone DOKO à réinstaller en Speek : à préparer avec le client avant l'intervention"
                          >
                            <Laptop className="size-2.5" />
                            {rows.filter((u) => u.softphone).length} Speek
                          </span>
                        )}
                        <AttributionClient
                          clientId={clientId}
                          attribueA={rows[0].clientAttribueA}
                          monEmail={monEmail}
                          nomsComptes={nomsComptes}
                        />
                        {(sitesParClient[clientId]?.length ?? 0) > 1 && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <SitesClientBande
                              clientId={clientId}
                              sites={sitesParClient[clientId]}
                              rows={rows}
                            />
                          </span>
                        )}
                      </span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <MenuEtapeClient clientId={clientId} etapes={etapes} valeurs={valeursStatut} />
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {ouvert && rows.map((u) => {
                  const faitsUser = etapes.filter((e) => estEtapeResolue(u.statuts[e.id])).length;
                  return (
                  <TableRow
                    key={u.utilisateurId}
                    className={cn(faitsUser === etapes.length && "bg-[var(--pal-green-bg)]/30")}
                  >
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-baseline gap-2 font-medium">
                        {u.utilisateurNom}
                        <span
                          className={cn(
                            "font-mono text-[10.5px] tabular-nums",
                            faitsUser === etapes.length
                              ? "font-bold text-[color:var(--pal-green-fg)]"
                              : "text-muted-foreground"
                          )}
                        >
                          {faitsUser}/{etapes.length}
                        </span>
                        {u.softphone && (
                          <span
                            className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
                            title="Softphone DOKO à réinstaller en Speek sur le poste de travail"
                          >
                            <Laptop className="size-2.5" />
                            Speek
                          </span>
                        )}
                        {(sitesParClient[u.clientId]?.length ?? 0) > 1 && (
                          <SitePoste
                            utilisateurId={u.utilisateurId}
                            siteId={u.siteId}
                            sites={sitesParClient[u.clientId]}
                          />
                        )}
                      </span>
                      {(u.numeros.length > 0 || u.equipements.length > 0) && (
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {u.numeros.map((n) => (
                            <Fragment key={n.brut}>
                              <CopiePuce valeur={n.brut} titre="Numéro" />
                              {n.courts.map((c) => (
                                <CopiePuce key={c} valeur={c} titre="Court" />
                              ))}
                            </Fragment>
                          ))}
                          {u.equipements.map((e) => (
                            <CopiePuce key={e.mac} valeur={e.mac} titre={e.modele ?? "MAC"} />
                          ))}
                        </span>
                      )}
                    </TableCell>
                    {etapes.map((e) => (
                      <TableCell key={e.id} className="py-1">
                        <CelluleStatut
                          key={`${u.utilisateurId}:${e.id}:${u.statuts[e.id] ?? "À faire"}`}
                          utilisateurId={u.utilisateurId}
                          etapeId={e.id}
                          statut={u.statuts[e.id] ?? "À faire"}
                          valeurs={valeursStatut}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })}
              </Fragment>
            );
                  })}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
