"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
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
import { ImportModal } from "@/components/ImportModal";
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
        <FileUp data-icon="inline-start" />
        Importer des utilisateurs (CSV Sewan)
      </Button>
      <ImportModal
        open={ouvert}
        onClose={fermer}
        titre="Importer des utilisateurs (CSV Sewan)"
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
              CSV Sewan — export « Utilisateurs »
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
            <Badge variant="outline">{applique.utilisateurs} utilisateurs</Badge>
            <Badge variant="outline">{applique.numeros} numéros</Badge>
            <Badge variant="outline">{applique.equipements} équipements</Badge>
            {applique.doublons > 0 && <Badge variant="outline">{applique.doublons} doublons ignorés</Badge>}
            {applique.modelesCrees.length > 0 && (
              <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
                {applique.modelesCrees.length} modèle(s) créé(s) : {applique.modelesCrees.join(", ")}
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
              <TableHeader className="sticky top-0 z-10">
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
                    <TableCell className="whitespace-nowrap">
                      {r.equipements.length > 0 ? r.equipements.map((e) => e.modele).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">
                      {r.equipements.filter((e) => e.mac).map((e) => e.mac).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Checkbox checked={doko.has(i)} onCheckedChange={() => toggleDoko(i)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={fermer}>Annuler</Button>
            <Button onClick={valider} disabled={isPending}>
              {isPending ? "Import…" : `Importer ${rows.length} utilisateurs`}
            </Button>
          </div>
        </>
      )}
        </div>
      </ImportModal>
    </>
  );
}
