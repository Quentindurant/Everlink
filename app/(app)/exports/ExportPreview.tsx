"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExportEcart } from "@/lib/repositories/syncRepository";

const TOUS = "tous";

export function ExportScopeBar({
  type,
  lots,
  clients,
  nomFichier,
}: {
  type: "sda" | "mac";
  lots: { id: string; nom: string }[];
  clients: { id: string; raisonSociale: string }[];
  nomFichier: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/import-${type}?${params.toString()}`);
    });
  };

  const urlTelechargement = `/api/exports/${type}?${searchParams.toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <Select
        items={[
          { value: TOUS, label: "Lot : tous" },
          ...lots.map((l) => ({ value: l.id, label: l.nom })),
        ]}
        defaultValue={searchParams.get("lot") ?? TOUS}
        onValueChange={(v) => setParam("lot", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Lot : tous</SelectItem>
          {lots.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Client : tous" },
          ...clients.map((c) => ({ value: c.id, label: c.raisonSociale })),
        ]}
        defaultValue={searchParams.get("client") ?? TOUS}
        onValueChange={(v) => setParam("client", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Client : tous</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.raisonSociale}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors select-none has-[[data-checked]]:border-primary/40 has-[[data-checked]]:bg-primary/5 has-[[data-checked]]:text-foreground">
        <Checkbox
          defaultChecked={searchParams.get("exclureBascules") === "1"}
          onCheckedChange={(checked) => setParam("exclureBascules", checked ? "1" : "")}
        />
        Exclure les clients déjà basculés
      </label>
      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{nomFichier}</span>
        <Button size="sm" render={<a href={urlTelechargement} download />}>
          <Download data-icon="inline-start" />
          Télécharger
        </Button>
      </div>
    </div>
  );
}

export function ExportPreviewTables({
  entetes,
  rows,
  repartition,
  ecarts,
}: {
  entetes: string[];
  rows: string[][];
  repartition: { raisonSociale: string; nb: number }[];
  ecarts: ExportEcart[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge className="tabular-nums">{rows.length} lignes exportées</Badge>
        {repartition.map((r) => (
          <Badge key={r.raisonSociale} variant="outline" className="tabular-nums">
            {r.raisonSociale} : {r.nb}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-10 text-xs font-semibold text-muted-foreground">
                  #
                </TableHead>
                {entetes.map((h) => (
                  <TableHead key={h} className="h-9 text-xs font-semibold text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={entetes.length + 1}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    Aucune ligne éligible dans cette portée.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row[0]}</TableCell>
                    <TableCell className="font-mono text-[13px] whitespace-nowrap">
                      {row[1]}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="overflow-x-auto self-start rounded-xl border bg-card shadow-xs">
          <p className="border-b p-3 text-sm font-medium">
            Lignes écartées <span className="text-muted-foreground">({ecarts.length})</span>
          </p>
          {ecarts.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Aucune ligne écartée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">
                    Client
                  </TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">
                    Valeur
                  </TableHead>
                  <TableHead className="h-8 text-xs font-semibold text-muted-foreground">
                    Motif
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ecarts.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{e.raisonSociale}</TableCell>
                    <TableCell className="font-mono text-[13px] whitespace-nowrap">
                      {e.valeur}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.motif}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
