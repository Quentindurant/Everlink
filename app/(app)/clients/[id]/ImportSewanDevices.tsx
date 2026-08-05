"use client";

import { useRef, useState, useTransition } from "react";
import { MonitorSmartphone, Upload } from "lucide-react";
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
import { ImportModal } from "@/components/ImportModal";
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

  const nouveaux = rows?.filter((r) => !r.dejaPresent).length ?? 0;

  const fermer = () => {
    setOuvert(false);
    setRows(null);
    setApplique(null);
    setErreur(null);
  };
  const etapeLabel = applique
    ? "Étape 3/3 — rapport"
    : rows
      ? "Étape 2/3 — aperçu et validation"
      : "Étape 1/3 — dépôt du fichier";

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOuvert(true)}>
        <MonitorSmartphone data-icon="inline-start" />
        Importer les équipements (CSV Sewan)
      </Button>
      <ImportModal
        open={ouvert}
        onClose={fermer}
        titre="Importer les équipements (CSV Sewan)"
        etapeLabel={etapeLabel}
      >
        <div className="flex flex-col gap-3 p-5">
      {!rows && !applique && (
        <form action={previsualiser} className="flex flex-col gap-3">
          <label
            className="block cursor-pointer rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors"
            style={{ borderColor: "var(--ev-sel-border)", background: "oklch(0.985 0.004 255)" }}
          >
            <div className="mb-1.5 text-[13.5px] font-semibold">Déposez le fichier ici</div>
            <div className="mb-3.5 text-xs" style={{ color: "var(--ev-text-tertiary)" }}>
              CSV Sewan — export « Équipements »
            </div>
            <input
              ref={inputRef}
              type="file"
              name="fichier"
              accept=".csv,text/csv"
              required
              className="mx-auto block text-sm file:mr-3 file:rounded-[7px] file:border-0 file:bg-primary file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={fermer}>Annuler</Button>
            <Button size="sm" type="submit" disabled={isPending}>
              <Upload data-icon="inline-start" />
              {isPending ? "Analyse…" : "Prévisualiser"}
            </Button>
          </div>
          {erreur && <span className="text-sm text-destructive">{erreur}</span>}
        </form>
      )}

      {applique && (
        <div className="px-1 py-4 text-center">
          <div
            className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full text-xl font-bold"
            style={{ background: "var(--pal-green-bg)", color: "var(--pal-green-fg)" }}
          >
            ✓
          </div>
          <div className="mb-3.5 text-sm font-bold">Import terminé</div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <Badge variant="outline">{applique.crees} équipements créés (sans utilisateur)</Badge>
            {applique.dejaPresents > 0 && (
              <Badge variant="outline">{applique.dejaPresents} déjà présents, ignorés</Badge>
            )}
            {applique.modelesCrees.length > 0 && (
              <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
                modèles créés (éligibles export) : {applique.modelesCrees.join(", ")}
              </Badge>
            )}
          </div>
          <div className="mt-5">
            <Button size="sm" onClick={fermer}>Fermer</Button>
          </div>
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
              <TableHeader className="sticky top-0 z-10">
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
                        <Badge className="border-transparent bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]">
                          nouveau
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={fermer}>Annuler</Button>
            <Button onClick={valider} disabled={isPending || nouveaux === 0}>
              {isPending ? "Import…" : `Importer ${nouveaux} nouveaux équipements`}
            </Button>
          </div>
        </>
      )}
        </div>
      </ImportModal>
    </>
  );
}
