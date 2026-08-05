"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
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
import type {
  ImportTechResultat,
  TechnicienImportRow,
} from "@/lib/repositories/importTechniciensRepository";
import { previsualiserTechniciensAction, validerTechniciensAction } from "./importActions";

export function ImportTechniciens() {
  const [ouvert, setOuvert] = useState(false);
  const [rows, setRows] = useState<TechnicienImportRow[] | null>(null);
  const [applique, setApplique] = useState<ImportTechResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const r = await previsualiserTechniciensAction(formData);
      if (r.success) setRows(r.rows);
      else {
        setErreur(r.error);
        setRows(null);
      }
    });
  };

  const valider = () => {
    if (!rows) return;
    startTransition(async () => {
      const r = await validerTechniciensAction(rows);
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
        <FileUp data-icon="inline-start" />
        Importer des techniciens (.xlsx)
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Import techniciens (fichier .xlsx)</span>
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
          <Badge variant="outline">{applique.crees} créés</Badge>
          {applique.doublons > 0 && <Badge variant="outline">{applique.doublons} doublons ignorés</Badge>}
          {applique.prestatairesCrees.length > 0 && (
            <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
              {applique.prestatairesCrees.length} prestataire(s) créé(s)
            </Badge>
          )}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="tabular-nums">{rows.length} techniciens</Badge>
            <span className="text-muted-foreground">Vérifiez les départements (extraits en best-effort du fichier).</span>
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {["Nom", "Départements", "Société", "Téléphone"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium whitespace-nowrap">{r.nom}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.departements.join(" ") || "tous"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.prestataireNom ?? "—"}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.telephone ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button onClick={valider} disabled={isPending}>
              {isPending ? "Import…" : `Importer ${rows.length} techniciens`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
