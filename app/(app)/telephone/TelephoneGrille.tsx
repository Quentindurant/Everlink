"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Hand, X } from "lucide-react";
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
import {
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
}: {
  clientId: string;
  attribueA: string | null;
  monEmail: string;
}) {
  const [isPending, startTransition] = useTransition();
  const agir = (prendre: boolean) =>
    startTransition(async () => {
      await attribuerClientTelephoneAction(clientId, prendre);
    });
  const prenom = (email: string) => email.split("@")[0];

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
      title={aMoi ? "Ce client vous est attribué" : `Attribué à ${attribueA}`}
    >
      <Hand className="size-2.5" />
      {aMoi ? "à moi" : prenom(attribueA)}
      <button
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          if (aMoi || window.confirm(`Client attribué à ${attribueA}. Le libérer ?`)) agir(false);
        }}
        className="ml-0.5 rounded-full hover:bg-black/10"
        title={aMoi ? "Libérer le client" : "Libérer (attribué à un autre tech)"}
      >
        <X className="size-2.5" />
      </button>
    </span>
  );
}

export function TelephoneGrille({ grille, monEmail }: { grille: Grille; monEmail: string }) {
  const { etapes, utilisateurs, valeursStatut } = grille;
  // Bandes clients repliées par défaut (comme le Provisionning) : on ouvre le client
  // qu'on travaille, la grille reste légère.
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
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

  const nbColonnes = etapes.length + 1;
  const toutDeplie = deplies.size >= groupes.size && groupes.size > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {groupes.size} client{groupes.size > 1 ? "s" : ""} · cliquez une bande pour ouvrir
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
          {Array.from(groupes.entries()).map(([raisonSociale, rows]) => {
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
                  className="cursor-pointer bg-[var(--ev-thead)] hover:bg-[var(--ev-row-hover)]"
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
                          className="text-[13.5px] font-bold hover:underline"
                        >
                          {raisonSociale}
                        </Link>
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
                          {rows.length} utilisateur{rows.length > 1 ? "s" : ""}
                        </span>
                        <AttributionClient
                          clientId={clientId}
                          attribueA={rows[0].clientAttribueA}
                          monEmail={monEmail}
                        />
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
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
