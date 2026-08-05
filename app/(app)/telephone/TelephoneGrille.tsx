"use client";

import { Fragment, useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
import { setEtapeClientAction, setSuiviEtapeAction } from "./actions";

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
        statut === "Sans objet" && "text-muted-foreground/60 hover:border-input",
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

export function TelephoneGrille({ grille }: { grille: Grille }) {
  const { etapes, utilisateurs, valeursStatut } = grille;

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

  return (
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
            const total = rows.length * etapes.length;
            const faits = rows.reduce(
              (acc, u) =>
                acc + etapes.filter((e) => u.statuts[e.id] === "Fait").length,
              0
            );
            const pct = total > 0 ? Math.round((faits / total) * 100) : 0;
            return (
              <Fragment key={raisonSociale}>
                <TableRow className="bg-[var(--ev-thead)] hover:bg-[var(--ev-thead)]">
                  <TableCell colSpan={nbColonnes} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2.5">
                        <Link
                          href={`/clients/${clientId}`}
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
                      </span>
                      <MenuEtapeClient clientId={clientId} etapes={etapes} valeurs={valeursStatut} />
                    </div>
                  </TableCell>
                </TableRow>
                {rows.map((u) => {
                  const faitsUser = etapes.filter((e) => u.statuts[e.id] === "Fait").length;
                  return (
                  <TableRow
                    key={u.utilisateurId}
                    className={cn(faitsUser === etapes.length && "bg-[var(--pal-green-bg)]/30")}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      <span className="flex items-baseline gap-2">
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
  );
}
