"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, PackagePlus, Upload } from "lucide-react";
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
import type { StockPreviewRow, ImportStockResultat } from "@/lib/repositories/importStockRepository";
import { previsualiserStockAction, validerStockAction } from "./actions";

export function ImportStock() {
  const [ouvert, setOuvert] = useState(false);
  const [rows, setRows] = useState<StockPreviewRow[] | null>(null);
  const [ignores, setIgnores] = useState(0);
  const [applique, setApplique] = useState<ImportStockResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const r = await previsualiserStockAction(formData);
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
      const r = await validerStockAction(rows.map(({ dejaPresent: _d, ...row }) => row));
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
        <PackagePlus data-icon="inline-start" />
        Importer le stock (.xlsx)
      </Button>
    );
  }

  const nouveaux = rows?.filter((r) => !r.dejaPresent).length ?? 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Import stock matériel (un onglet par type)</span>
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
          <Badge variant="outline">{applique.crees} articles ajoutés</Badge>
          {applique.dejaPresents > 0 && (
            <Badge variant="outline">{applique.dejaPresents} déjà présents, ignorés</Badge>
          )}
          {Object.entries(applique.parType).map(([t, n]) => (
            <Badge key={t} className="border-transparent bg-[var(--pal-cyan-bg)] text-[color:var(--pal-cyan-fg)]">
              {t} : {n}
            </Badge>
          ))}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="tabular-nums">{nouveaux} nouveaux</Badge>
            <Badge variant="outline" className="tabular-nums">{rows.length - nouveaux} déjà présents</Badge>
            {ignores > 0 && <span className="text-muted-foreground">{ignores} lignes vides ignorées</span>}
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {["Type", "N° série", "Réception", "État", "Client final", ""].map((h, i) => (
                    <TableHead key={i} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={cn(r.dejaPresent && "opacity-50")}>
                    <TableCell className="whitespace-nowrap">{r.type}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.numeroSerie}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {r.dateReception ? new Date(r.dateReception).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.etatAppareil ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.clientFinal ?? "—"}</TableCell>
                    <TableCell>
                      {r.dejaPresent ? (
                        <Badge variant="outline">présent</Badge>
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
            <Button onClick={valider} disabled={isPending || nouveaux === 0}>
              {isPending ? "Import…" : `Importer ${nouveaux} articles`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
