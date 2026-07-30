"use client";

import { Fragment, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProvisionningLigne } from "@/lib/repositories/provisionningRepository";

const NIVEAU_COULEUR: Record<string, "default" | "secondary" | "destructive"> = {
  OK: "default",
  AVERTISSEMENT: "secondary",
  ERREUR: "destructive",
};

const columns: ColumnDef<ProvisionningLigne>[] = [
  { header: "Client (raison sociale)", accessorKey: "clientRaisonSociale" },
  { header: "Numéro à porter", accessorKey: "numeroBrut" },
  {
    header: "Numéro court",
    accessorFn: (row) => row.numerosCourts.join("/"),
  },
  {
    header: "Contrôle N°",
    id: "controle",
    cell: ({ row }) => {
      const { controleNiveau, controleDetail } = row.original;
      // controleNiveau is null on orphan équipement rows (no Numero, nothing to control) —
      // render nothing rather than a badge with an empty/undefined variant.
      if (!controleNiveau) return null;
      const badge = <Badge variant={NIVEAU_COULEUR[controleNiveau]}>{controleNiveau}</Badge>;
      if (!controleDetail) return badge;
      return (
        <Tooltip>
          {/* This project's Tooltip is built on @base-ui/react, not Radix — the trigger is
              swapped out via the `render` prop (a ReactElement), not Radix's `asChild`. */}
          <TooltipTrigger render={badge} />
          <TooltipContent>{controleDetail}</TooltipContent>
        </Tooltip>
      );
    },
  },
  { header: "Equipement", accessorKey: "equipementLibelle" },
  { header: "Adresse MAC équipement", accessorKey: "equipementMacBrut" },
  { header: "Utilisateur", accessorKey: "utilisateurNom" },
  { header: "Hébergeur source", accessorKey: "hebergeurSource" },
  { header: "Hébergeur cible", accessorKey: "hebergeurCible" },
  { header: "Bascule des numéros", accessorKey: "statutBascule" },
  {
    header: "Date bascule",
    accessorFn: (row) => (row.dateBascule ? row.dateBascule.toISOString().slice(0, 10) : ""),
  },
  { header: "Commentaires", accessorKey: "commentaire" },
];

export function ProvisionningTable({ lignes }: { lignes: ProvisionningLigne[] }) {
  const data = useMemo(() => lignes, [lignes]);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const groupes = useMemo(() => {
    const map = new Map<string, ProvisionningLigne[]>();
    for (const ligne of lignes) {
      const liste = map.get(ligne.clientRaisonSociale) ?? [];
      map.set(ligne.clientRaisonSociale, [...liste, ligne]);
    }
    return map;
  }, [lignes]);

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} style={{ textAlign: "left", padding: "0.25rem" }}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {Array.from(groupes.entries()).map(([raisonSociale, lignesDuClient]) => (
          <Fragment key={raisonSociale}>
            <tr style={{ background: "#f0f0f0" }}>
              <td colSpan={columns.length} style={{ padding: "0.25rem", fontWeight: "bold" }}>
                {raisonSociale} — {lignesDuClient.filter((l) => l.numeroId).length} numéro(s),{" "}
                {lignesDuClient.filter((l) => l.equipementMacBrut).length} MAC,{" "}
                {lignesDuClient.filter((l) => l.statutBascule === "Fait").length} bascule(s) faite(s)
              </td>
            </tr>
            {table
              .getRowModel()
              .rows.filter((r) => r.original.clientRaisonSociale === raisonSociale)
              .map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: "0.25rem" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
