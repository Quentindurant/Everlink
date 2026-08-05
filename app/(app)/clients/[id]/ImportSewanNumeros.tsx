"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Hash, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NumeroV4Preview, ImportNumerosResultat } from "@/lib/repositories/importNumerosRepository";
import { previsualiserNumerosV4Action, validerNumerosV4Action } from "./numerosActions";

export function ImportSewanNumeros({ clientId }: { clientId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [rows, setRows] = useState<NumeroV4Preview[] | null>(null);
  const [ignores, setIgnores] = useState(0);
  const [applique, setApplique] = useState<ImportNumerosResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const r = await previsualiserNumerosV4Action(clientId, formData);
      if (r.success) {
        setRows(r.rows);
        setIgnores(r.ignores);
      } else {
        setErreur(r.error);
        setRows(null);
      }
    });
  };

  const valider = () => {
    if (!rows) return;
    startTransition(async () => {
      const r = await validerNumerosV4Action(
        clientId,
        rows.map(({ dejaPresent: _d, enrichitRio: _e, ...row }) => row)
      );
      if (r.success) {
        setApplique(r.resultat);
        setRows(null);
        if (inputRef.current) inputRef.current.value = "";
      } else setErreur(r.error);
    });
  };

  if (!ouvert) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOuvert(true)}>
        <Hash data-icon="inline-start" />
        Importer les numéros (Sewan v4)
      </Button>
    );
  }

  const nouveaux = rows?.filter((r) => !r.dejaPresent).length ?? 0;
  const aEnrichir = rows?.filter((r) => r.enrichitRio).length ?? 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Import numéros — export Sewan v4 (.xlsx, avec RIO)</span>
        <Button variant="ghost" size="xs" onClick={() => setOuvert(false)}>Fermer</Button>
      </div>

      <form action={previsualiser} className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          name="fichier"
          accept=".xlsx"
          required
          className="text-sm file:mr-3 file:rounded-lg file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <Button size="sm" type="submit" disabled={isPending}>
          <Upload data-icon="inline-start" />
          {isPending ? "Analyse…" : "Prévisualiser"}
        </Button>
        {erreur && <span className="text-sm text-destructive">{erreur}</span>}
      </form>

      {applique && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--pal-green-dot)] bg-[var(--pal-green-bg)] p-3 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <Badge variant="outline">{applique.crees} numéros créés</Badge>
          {applique.enrichis > 0 && (
            <Badge className="border-transparent bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">
              {applique.enrichis} RIO ajoutés à des numéros existants
            </Badge>
          )}
          {applique.dejaPresents > 0 && (
            <Badge variant="outline">{applique.dejaPresents} déjà présents, inchangés</Badge>
          )}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="tabular-nums">{nouveaux} nouveaux</Badge>
            {aEnrichir > 0 && (
              <Badge className="border-transparent bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)] tabular-nums">
                {aEnrichir} à enrichir (RIO)
              </Badge>
            )}
            <Badge variant="outline" className="tabular-nums">{rows.length - nouveaux} déjà présents</Badge>
            {ignores > 0 && <span className="text-muted-foreground">{ignores} sans numéro, ignorés</span>}
            <span className="text-muted-foreground">· Les nouveaux sont créés sans utilisateur.</span>
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {["Numéro", "RIO", "Service", "Statut", "État"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={cn(r.dejaPresent && !r.enrichitRio && "opacity-50")}>
                    <TableCell className="font-mono text-[13px]">{r.numeroBrut}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.rio ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.service ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.statut ?? "—"}</TableCell>
                    <TableCell>
                      {r.enrichitRio ? (
                        <Badge className="border-transparent bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">+ RIO</Badge>
                      ) : r.dejaPresent ? (
                        <Badge variant="outline">déjà présent</Badge>
                      ) : (
                        <Badge className="border-transparent bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]">nouveau</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button onClick={valider} disabled={isPending || (nouveaux === 0 && aEnrichir === 0)}>
              {isPending ? "Import…" : `Importer (${nouveaux} nouveaux, ${aEnrichir} enrichis)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
