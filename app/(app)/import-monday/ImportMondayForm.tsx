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
import type { ApplicationResultat } from "@/lib/repositories/importMondayRepository";
import {
  previsualiserAction,
  validerAction,
  type PrevisualisationPayload,
} from "./actions";

export function ImportMondayForm() {
  const [payload, setPayload] = useState<PrevisualisationPayload | null>(null);
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [applique, setApplique] = useState<ApplicationResultat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previsualiser = (formData: FormData) => {
    setErreur(null);
    setApplique(null);
    startTransition(async () => {
      const result = await previsualiserAction(formData);
      if (result.success) {
        setPayload(result.payload);
        setDecisions({});
      } else {
        setErreur(result.error);
        setPayload(null);
      }
    });
  };

  const valider = () => {
    if (!payload) return;
    setErreur(null);
    startTransition(async () => {
      const result = await validerAction(payload, decisions);
      if (result.success) {
        setApplique(result.resultat);
        setPayload(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setErreur(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form action={previsualiser} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <FileUp className="size-5 text-muted-foreground" />
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--pal-green-dot)] bg-[var(--pal-green-bg)] p-3 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span className="font-medium">Import appliqué :</span>
          <Badge variant="outline">{applique.crees} créés</Badge>
          <Badge variant="outline">{applique.misAJour} mis à jour</Badge>
          <Badge variant="outline">{applique.ignores} ignorés</Badge>
          {applique.modelesCrees.length > 0 && (
            <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
              {applique.modelesCrees.length} modèle(s) créé(s) — vérifier l'éligibilité dans
              Paramètres
            </Badge>
          )}
          {applique.erreurs.map((e, i) => (
            <span key={i} className="text-destructive">{e}</span>
          ))}
        </div>
      )}

      {payload && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="tabular-nums">{payload.nomFichier}</Badge>
            <Badge variant="outline" className="tabular-nums">
              {payload.resultat.aCreer.length} à créer
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              {payload.resultat.aMettreAJour.length} à mettre à jour
            </Badge>
            <Badge
              variant="outline"
              className={
                payload.resultat.aRapprocher.length > 0
                  ? "border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
                  : ""
              }
            >
              {payload.resultat.aRapprocher.length} à rapprocher
            </Badge>
            {payload.resultat.modelesInconnus.length > 0 && (
              <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
                Modèles inconnus : {payload.resultat.modelesInconnus.join(", ")}
              </Badge>
            )}
            {payload.erreurs.map((e, i) => (
              <span key={i} className="text-sm text-destructive">{e}</span>
            ))}
          </div>

          {payload.resultat.aRapprocher.length > 0 && (
            <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
              <p className="border-b p-3 text-sm font-medium">
                Rapprochements à trancher — aucune fusion automatique
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-muted-foreground">
                      Ligne du fichier
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground">
                      Décision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.resultat.aRapprocher.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        {r.ligne.raisonSociale}
                        {r.ligne.codeMonday && (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {r.ligne.codeMonday}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <select
                          value={decisions[i] ?? ""}
                          onChange={(e) =>
                            setDecisions((prev) => ({ ...prev, [i]: e.target.value }))
                          }
                          className="rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                        >
                          <option value="">— choisir —</option>
                          <option value="creer">Créer un nouveau client</option>
                          <option value="ignorer">Ignorer la ligne</option>
                          {r.candidats.map((c) => (
                            <option key={c.id} value={c.id}>
                              Fusionner avec « {c.raisonSociale} »
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Button onClick={valider} disabled={isPending}>
              {isPending ? "Application…" : "Valider l'import"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
