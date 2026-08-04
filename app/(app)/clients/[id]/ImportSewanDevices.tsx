"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, MonitorSmartphone, Upload } from "lucide-react";
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
import type { DevicePreviewRow, ImportDevicesResultat } from "@/lib/repositories/importDevicesRepository";
import { previsualiserDevicesAction, validerDevicesAction } from "./devicesActions";

export function ImportSewanDevices({ clientId }: { clientId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [rows, setRows] = useState<DevicePreviewRow[] | null>(null);
  const [ignores, setIgnores] = useState(0);
  const [applique, setApplique] = useState<ImportDevicesResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const r = await previsualiserDevicesAction(clientId, formData);
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
      const r = await validerDevicesAction(
        clientId,
        rows.map(({ dejaPresent: _d, ...row }) => row)
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
        <MonitorSmartphone data-icon="inline-start" />
        Importer les équipements (CSV Sewan)
      </Button>
    );
  }

  const nouveaux = rows?.filter((r) => !r.dejaPresent).length ?? 0;

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Import équipements — export Sewan (.csv)</span>
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
          <Badge variant="outline">{applique.crees} équipements créés (sans utilisateur)</Badge>
          {applique.dejaPresents > 0 && (
            <Badge variant="outline">{applique.dejaPresents} déjà présents, ignorés</Badge>
          )}
          {applique.modelesCrees.length > 0 && (
            <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
              modèles créés (éligibles export) : {applique.modelesCrees.join(", ")}
            </Badge>
          )}
        </div>
      )}

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className="tabular-nums">{nouveaux} nouveaux</Badge>
            <Badge variant="outline" className="tabular-nums">{rows.length - nouveaux} déjà présents</Badge>
            {ignores > 0 && <span className="text-muted-foreground">{ignores} sans identifiant, ignorés</span>}
            <span className="text-muted-foreground">
              · Les nouveaux sont créés sans utilisateur ni numéro, éligibles aux exports.
            </span>
          </div>
          <div className="max-h-96 overflow-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  {["Modèle", "MAC / IPUI", "Utilisateur Sewan", "État"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={cn(r.dejaPresent && "opacity-50")}>
                    <TableCell className="whitespace-nowrap">{r.modele}</TableCell>
                    <TableCell className="font-mono text-[13px]">{r.mac}</TableCell>
                    <TableCell className="max-w-60 truncate text-xs text-muted-foreground">
                      {r.utilisateurSewan ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.dejaPresent ? (
                        <Badge variant="outline">déjà présent</Badge>
                      ) : (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          nouveau
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button onClick={valider} disabled={isPending || nouveaux === 0}>
              {isPending ? "Import…" : `Importer ${nouveaux} nouveaux équipements`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
