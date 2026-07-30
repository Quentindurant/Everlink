"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProvisionningLigne } from "@/lib/repositories/provisionningRepository";
import {
  updateNumeroCellAction,
  forcerControleAction,
  ajouterLigneAction,
  updateEquipementMacAction,
  updateUtilisateurNomAction,
  actionMasseAction,
} from "./actions";

const NIVEAU_COULEUR: Record<string, "default" | "secondary" | "destructive"> = {
  OK: "default",
  AVERTISSEMENT: "secondary",
  ERREUR: "destructive",
};

function EditableCell({
  valeurInitiale,
  onSave,
}: {
  valeurInitiale: string;
  onSave: (valeur: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [valeur, setValeur] = useState(valeurInitiale);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enregistrer = () => {
    if (valeur === valeurInitiale) return;
    const valeurPrecedente = valeurInitiale;
    startTransition(async () => {
      const result = await onSave(valeur);
      if (!result.success) {
        setValeur(valeurPrecedente);
        setErreur(result.error ?? "Échec de la sauvegarde.");
        setTimeout(() => setErreur(null), 3000);
      }
    });
  };

  return (
    <div>
      <input
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={enregistrer}
        onKeyDown={(e) => e.key === "Enter" && enregistrer()}
        disabled={isPending}
        style={{ width: "100%", border: "none", background: "transparent" }}
      />
      {erreur && <span style={{ color: "red", fontSize: "0.75rem" }}>{erreur}</span>}
    </div>
  );
}

function ControleCell({ ligne }: { ligne: ProvisionningLigne }) {
  const [isPending, startTransition] = useTransition();

  // Orphan équipement rows have no Numero, hence no Contrôle N° at all — nothing to render or
  // force. This action only applies to Numero-backed rows (ligne.numeroId non-null).
  if (!ligne.controleNiveau || !ligne.numeroId) return null;
  const numeroId = ligne.numeroId;

  const badge = <Badge variant={NIVEAU_COULEUR[ligne.controleNiveau]}>{ligne.controleNiveau}</Badge>;
  const trigger = ligne.controleDetail ? (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent>{ligne.controleDetail}</TooltipContent>
    </Tooltip>
  ) : (
    badge
  );

  const forcer = () => {
    const motif = window.prompt("Motif du forçage:");
    if (!motif) return;
    startTransition(async () => {
      await forcerControleAction(numeroId, motif);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      {ligne.controleNiveau !== "OK" && (
        <DropdownMenuContent>
          <DropdownMenuItem onClick={forcer} disabled={isPending}>
            Forcer OK
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

function AjouterLigneMenu({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const ajouter = (type: "numero" | "equipement" | "complete") => {
    startTransition(async () => {
      await ajouterLigneAction(clientId, type);
    });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button disabled={isPending}>+ Ajouter</button>} />
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => ajouter("numero")}>Numéro seul</DropdownMenuItem>
        <DropdownMenuItem onClick={() => ajouter("equipement")}>Équipement seul</DropdownMenuItem>
        <DropdownMenuItem onClick={() => ajouter("complete")}>Ligne complète</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BarreActionsMasse({ selection }: { selection: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [hebergeur, setHebergeur] = useState("UNYC");
  if (selection.length === 0) return null;

  const executer = (action: Parameters<typeof actionMasseAction>[1]) => {
    startTransition(async () => {
      await actionMasseAction(selection, action);
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem", background: "#eef", alignItems: "center" }}>
      <span>{selection.length} ligne(s) sélectionnée(s)</span>
      <AlertDialog>
        <AlertDialogTrigger render={<button disabled={isPending}>Passer à Fait</button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la bascule</AlertDialogTitle>
            <AlertDialogDescription>
              Passer {selection.length} numéro(s) à "Fait" avec la date d'aujourd'hui ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                executer({ type: "basculeFaite", date: new Date().toISOString() })
              }
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger render={<button disabled={isPending}>Exclure de l'export</button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'exclusion</AlertDialogTitle>
            <AlertDialogDescription>
              Exclure {selection.length} numéro(s) de l'export ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executer({ type: "exclureExport", valeur: true })}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Select value={hebergeur} onValueChange={(v) => setHebergeur(v as string)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SEWAN">SEWAN</SelectItem>
          <SelectItem value="UNYC">UNYC</SelectItem>
        </SelectContent>
      </Select>
      <AlertDialog>
        <AlertDialogTrigger render={<button disabled={isPending}>Affecter hébergeur cible</button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'affectation</AlertDialogTitle>
            <AlertDialogDescription>
              Affecter l'hébergeur cible "{hebergeur}" au(x) client(s) des {selection.length} numéro(s)
              sélectionné(s) ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executer({ type: "hebergeurCible", valeur: hebergeur })}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildColumns(
  selection: string[],
  basculerSelection: (numeroId: string) => void
): ColumnDef<ProvisionningLigne>[] {
  return [
  {
    id: "selection",
    header: "",
    // Bulk actions (actionMasseAction) operate on Numero ids — orphan équipement rows have none,
    // so they get no checkbox rather than one that would call basculerSelection(null).
    cell: ({ row }) =>
      row.original.numeroId ? (
        <Checkbox
          checked={selection.includes(row.original.numeroId)}
          onCheckedChange={() => basculerSelection(row.original.numeroId as string)}
        />
      ) : null,
  },
  { header: "Client (raison sociale)", accessorKey: "clientRaisonSociale" },
  {
    header: "Numéro à porter",
    id: "numeroBrut",
    cell: ({ row }) =>
      row.original.numeroId ? (
        <EditableCell
          valeurInitiale={row.original.numeroBrut ?? ""}
          onSave={(v) => updateNumeroCellAction(row.original.numeroId as string, "numeroBrut", v)}
        />
      ) : (
        row.original.numeroBrut ?? ""
      ),
  },
  {
    header: "Numéro court",
    id: "numerosCourts",
    cell: ({ row }) =>
      row.original.numeroId ? (
        <EditableCell
          valeurInitiale={row.original.numerosCourts.join("/")}
          onSave={(v) => updateNumeroCellAction(row.original.numeroId as string, "numerosCourts", v)}
        />
      ) : (
        row.original.numerosCourts.join("/")
      ),
  },
  {
    header: "Contrôle N°",
    id: "controle",
    cell: ({ row }) => <ControleCell ligne={row.original} />,
  },
  { header: "Equipement", accessorKey: "equipementLibelle" },
  {
    header: "Adresse MAC équipement",
    id: "equipementMacBrut",
    cell: ({ row }) =>
      row.original.equipementId ? (
        <EditableCell
          valeurInitiale={row.original.equipementMacBrut ?? ""}
          onSave={(v) => updateEquipementMacAction(row.original.equipementId as string, v)}
        />
      ) : (
        row.original.equipementMacBrut ?? ""
      ),
  },
  {
    header: "Utilisateur",
    id: "utilisateurNom",
    cell: ({ row }) =>
      row.original.utilisateurId ? (
        <EditableCell
          valeurInitiale={row.original.utilisateurNom ?? ""}
          onSave={(v) => updateUtilisateurNomAction(row.original.utilisateurId as string, v)}
        />
      ) : (
        row.original.utilisateurNom ?? ""
      ),
  },
  { header: "Hébergeur source", accessorKey: "hebergeurSource" },
  { header: "Hébergeur cible", accessorKey: "hebergeurCible" },
  {
    header: "Bascule des numéros",
    id: "statutBascule",
    cell: ({ row }) =>
      row.original.numeroId ? (
        <EditableCell
          valeurInitiale={row.original.statutBascule ?? ""}
          onSave={(v) => updateNumeroCellAction(row.original.numeroId as string, "statutBascule", v)}
        />
      ) : (
        row.original.statutBascule ?? ""
      ),
  },
  {
    header: "Date bascule",
    accessorFn: (row) => (row.dateBascule ? row.dateBascule.toISOString().slice(0, 10) : ""),
  },
  {
    header: "Commentaires",
    id: "commentaire",
    cell: ({ row }) =>
      row.original.numeroId ? (
        <EditableCell
          valeurInitiale={row.original.commentaire ?? ""}
          onSave={(v) => updateNumeroCellAction(row.original.numeroId as string, "commentaire", v)}
        />
      ) : (
        row.original.commentaire ?? ""
      ),
  },
  ];
}

export function ProvisionningTable({ lignes }: { lignes: ProvisionningLigne[] }) {
  const data = useMemo(() => lignes, [lignes]);
  const [selection, setSelection] = useState<string[]>([]);
  const basculerSelection = (numeroId: string) => {
    setSelection((prev) =>
      prev.includes(numeroId) ? prev.filter((id) => id !== numeroId) : [...prev, numeroId]
    );
  };
  const columns = useMemo(() => buildColumns(selection, basculerSelection), [selection]);
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
    <>
    <BarreActionsMasse selection={selection} />
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
        {Array.from(groupes.entries()).map(([raisonSociale, lignesDuClient]) => {
          const clientId = lignesDuClient[0]?.clientId;
          return (
            <Fragment key={raisonSociale}>
              <tr style={{ background: "#f0f0f0" }}>
                <td colSpan={columns.length} style={{ padding: "0.25rem", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    {raisonSociale} — {lignesDuClient.filter((l) => l.numeroId).length} numéro(s),{" "}
                    {lignesDuClient.filter((l) => l.equipementMacBrut).length} MAC,{" "}
                    {lignesDuClient.filter((l) => l.statutBascule === "Fait").length} bascule(s) faite(s)
                  </span>
                  {clientId && <AjouterLigneMenu clientId={clientId} />}
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
          );
        })}
      </tbody>
    </table>
    </>
  );
}
