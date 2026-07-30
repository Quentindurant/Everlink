"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LotLigne } from "@/lib/repositories/lotsRepository";
import { creerLotAction, updateLotAction } from "./actions";

function ChampEditable({
  valeurInitiale,
  onSave,
  placeholder,
}: {
  valeurInitiale: string;
  onSave: (valeur: string) => Promise<{ success: boolean; error?: string }>;
  placeholder?: string;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enregistrer = () => {
    if (valeur === valeurInitiale) return;
    startTransition(async () => {
      const result = await onSave(valeur);
      if (!result.success) {
        setValeur(valeurInitiale);
        setErreur(result.error ?? "Échec de la sauvegarde.");
        setTimeout(() => setErreur(null), 3000);
      }
    });
  };

  return (
    <div>
      <input
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={enregistrer}
        onKeyDown={(e) => e.key === "Enter" && enregistrer()}
        disabled={isPending}
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm transition-colors outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
      />
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}

function FormNouveauLot() {
  const [nom, setNom] = useState("");
  const [reference, setReference] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const creer = () => {
    startTransition(async () => {
      const result = await creerLotAction(nom, reference);
      if (result.success) {
        setNom("");
        setReference("");
      } else {
        setErreur(result.error ?? "Échec de la création.");
        setTimeout(() => setErreur(null), 3000);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <Input
        placeholder="Nom du lot (ex. LOT 2)"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="w-48"
      />
      <Input
        placeholder="Référence export (ex. EVLOT0S28)"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        className="w-56"
      />
      <Button size="sm" onClick={creer} disabled={isPending || !nom.trim()}>
        <Plus data-icon="inline-start" />
        Créer le lot
      </Button>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
    </div>
  );
}

export function LotsTable({ lots }: { lots: LotLigne[] }) {
  const [, startTransition] = useTransition();

  if (lots.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <FormNouveauLot />
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Aucun lot. Créez le premier ci-dessus.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FormNouveauLot />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold text-muted-foreground">Nom</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Référence export
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Clients</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Numéros</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">
                Avancement bascules
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.map((lot) => {
              const pct =
                lot.nbNumeros > 0
                  ? Math.round((lot.nbBasculesFaites / lot.nbNumeros) * 100)
                  : 0;
              return (
                <TableRow key={lot.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients?lot=${lot.id}`} className="hover:underline">
                      {lot.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="w-56">
                    <ChampEditable
                      key={`ref:${lot.id}:${lot.reference ?? ""}`}
                      valeurInitiale={lot.reference ?? ""}
                      placeholder="—"
                      onSave={(v) => updateLotAction(lot.id, { reference: v })}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{lot.nbClients}</TableCell>
                  <TableCell className="tabular-nums">{lot.nbNumeros}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pct === 100 ? "bg-emerald-500" : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {lot.nbBasculesFaites}/{lot.nbNumeros} ({pct}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await updateLotAction(lot.id, { clos: !lot.clos });
                        })
                      }
                      title="Cliquer pour basculer"
                    >
                      {lot.clos ? (
                        <Badge variant="outline">Clos</Badge>
                      ) : (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          Actif
                        </Badge>
                      )}
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
