"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SewanUserRow } from "@/lib/domain/import/sewanUsers";
import type { ImportSewanResultat } from "@/lib/repositories/importSewanRepository";
import { previsualiserSewanAction, validerSewanAction } from "./sewanActions";

export function ImportSewanUsers({ clientId }: { clientId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [rows, setRows] = useState<SewanUserRow[] | null>(null);
  const [ignores, setIgnores] = useState(0);
  const [doko, setDoko] = useState<Set<number>>(new Set());
  const [applique, setApplique] = useState<ImportSewanResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const r = await previsualiserSewanAction(formData);
      if (r.success) {
        setRows(r.rows);
        setIgnores(r.ignores);
        setDoko(new Set());
      } else {
        setErreur(r.error);
        setRows(null);
      }
    });
  };

  const toggleDoko = (i: number) => {
    setDoko((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const valider = () => {
    if (!rows) return;
    startTransition(async () => {
      const r = await validerSewanAction(clientId, rows, [...doko]);
      if (r.success) {
        setApplique(r.resultat);
        setRows(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setErreur(r.error);
      }
    });
  };

  if (!ouvert) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOuvert(true)}>
        <FileUp data-icon="inline-start" />
        Importer des utilisateurs (CSV Sewan)
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Import utilisateurs — export Sewan (.csv)</span>
        <Button variant="ghost" size="xs" onClick={() => setOuvert(false)}>Fermer</Button>
      </div>

      <form action={previsualiser} className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          name="fichier"
          accept=".csv,text/csv"
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span className="font-medium">Import terminé :</span>
          <Badge variant="outline">{applique.utilisateurs} utilisateurs</Badge>
          <Badge variant="outline">{applique.numeros} numéros</Badge>
          <Badge variant="outline">{applique.equipements} équipements</Badge>
          {applique.doublons > 0 && <Badge variant="outline">{applique.doublons} doublons ignorés</Badge>}
          {applique.modelesCrees.length > 0 && (
            <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {applique.modelesCrees.length} modèle(s) créé(s) : {applique.modelesCrees.join(", ")}
            </Badge>
          )}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="tabular-nums">{rows.length} utilisateurs</Badge>
            {ignores > 0 && (
              <span className="text-muted-foreground">{ignores} ligne(s) sans numéro ignorée(s)</span>
            )}
            <span className="text-muted-foreground">
              · Cochez <strong>DOKO</strong> pour ajouter un softphone à un utilisateur.
            </span>
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {["Utilisateur", "Numéro", "Poste", "Équipement", "MAC", "DOKO"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{r.nom}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.numeroBrut}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.numeroInterne || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.equipementModele ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.equipementMac ?? "—"}</TableCell>
                    <TableCell>
                      <Checkbox checked={doko.has(i)} onCheckedChange={() => toggleDoko(i)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button onClick={valider} disabled={isPending}>
              {isPending ? "Import…" : `Importer ${rows.length} utilisateurs`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
