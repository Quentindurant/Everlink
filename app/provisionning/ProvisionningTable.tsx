"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type Row,
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

function StatutBasculeCell({
  numeroId,
  valeurInitiale,
  valeurs,
}: {
  numeroId: string;
  valeurInitiale: string;
  valeurs: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  // Le statut peut porter une valeur historique retirée de la liste (import legacy): on l'ajoute
  // aux options plutôt que de la faire disparaître silencieusement du select.
  const options = valeurs.includes(valeurInitiale) || valeurInitiale === ""
    ? valeurs
    : [valeurInitiale, ...valeurs];

  return (
    <div>
      <select
        value={valeurInitiale}
        disabled={isPending}
        onChange={(e) => {
          const valeur = e.target.value;
          startTransition(async () => {
            const result = await updateNumeroCellAction(numeroId, "statutBascule", valeur);
            if (!result.success) {
              setErreur(result.error ?? "Échec de la sauvegarde.");
              setTimeout(() => setErreur(null), 3000);
            }
          });
        }}
        style={{ width: "100%" }}
      >
        <option value=""></option>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      {erreur && <span style={{ color: "red", fontSize: "0.75rem" }}>{erreur}</span>}
    </div>
  );
}

function ControleCell({ ligne }: { ligne: ProvisionningLigne }) {
  const [isPending, startTransition] = useTransition();

  // Orphan équipement rows have no Numero, hence no Contrôle N° at all — nothing to render.
  if (!ligne.controleNiveau) return null;
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

  // Ligne de duplication (utilisateur multi-équipements): elle affiche le contrôle du même numéro
  // mais ne le possède pas. Badge en lecture seule, le forçage reste sur la ligne porteuse.
  if (!numeroId) return trigger;

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

function BarreActionsMasse({
  selection,
  onDone,
}: {
  selection: string[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [hebergeur, setHebergeur] = useState("UNYC");
  const [erreur, setErreur] = useState<string | null>(null);
  if (selection.length === 0) return null;

  const executer = (action: Parameters<typeof actionMasseAction>[1]) => {
    startTransition(async () => {
      const result = await actionMasseAction(selection, action);
      if (result.success) {
        onDone();
      } else {
        setErreur(result.error ?? "Échec de l'action.");
        setTimeout(() => setErreur(null), 5000);
      }
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", padding: "0.5rem", background: "#eef", alignItems: "center" }}>
      <span>{selection.length} ligne(s) sélectionnée(s)</span>
      {erreur && <span style={{ color: "red" }}>{erreur}</span>}
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
      <AlertDialog>
        <AlertDialogTrigger render={<button disabled={isPending}>Réintégrer dans l'export</button>} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la réintégration</AlertDialogTitle>
            <AlertDialogDescription>
              Réintégrer {selection.length} numéro(s) dans l'export ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executer({ type: "exclureExport", valeur: false })}
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
  basculerSelection: (numeroId: string) => void,
  valeursStatutBascule: string[]
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
        // `key` inclut la valeur serveur: quand elle change (action de masse, revalidate), le
        // champ est remonté et se resynchronise, au lieu de garder un état périmé qu'un blur
        // réécrirait par-dessus la mise à jour.
        <EditableCell
          key={`numeroBrut:${row.id}:${row.original.numeroBrut ?? ""}`}
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
          key={`numerosCourts:${row.id}:${row.original.numerosCourts.join("/")}`}
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
          key={`equipementMacBrut:${row.id}:${row.original.equipementMacBrut ?? ""}`}
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
          key={`utilisateurNom:${row.id}:${row.original.utilisateurNom ?? ""}`}
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
        <StatutBasculeCell
          key={`statutBascule:${row.id}:${row.original.statutBascule ?? ""}`}
          numeroId={row.original.numeroId}
          valeurInitiale={row.original.statutBascule ?? ""}
          valeurs={valeursStatutBascule}
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
          key={`commentaire:${row.id}:${row.original.commentaire ?? ""}`}
          valeurInitiale={row.original.commentaire ?? ""}
          onSave={(v) => updateNumeroCellAction(row.original.numeroId as string, "commentaire", v)}
        />
      ) : (
        row.original.commentaire ?? ""
      ),
  },
  ];
}

export function ProvisionningTable({
  lignes,
  valeursStatutBascule,
}: {
  lignes: ProvisionningLigne[];
  valeursStatutBascule: string[];
}) {
  const data = useMemo(() => lignes, [lignes]);
  const [selection, setSelection] = useState<string[]>([]);
  const basculerSelection = (numeroId: string) => {
    setSelection((prev) =>
      prev.includes(numeroId) ? prev.filter((id) => id !== numeroId) : [...prev, numeroId]
    );
  };
  // Une sélection survivant à un changement de filtre ou à un archivage viserait des numéros
  // invisibles: l'action de masse s'appliquerait alors à des lignes que l'opérateur ne voit plus.
  useEffect(() => {
    setSelection((prev) => prev.filter((id) => lignes.some((l) => l.numeroId === id)));
  }, [lignes]);
  const columns = useMemo(
    () => buildColumns(selection, basculerSelection, valeursStatutBascule),
    [selection, valeursStatutBascule]
  );
  const table = useReactTable({
    data,
    columns,
    // Sans `getRowId`, l'id de ligne est l'index du tableau. Après un ajout ou un revalidate les
    // index glissent, et un EditableCell monté conserve son état pendant que sa closure `onSave`
    // vise désormais un autre enregistrement: le numéro d'un client atterrit chez un autre.
    getRowId: (row) => row.numeroId ?? `eq-${row.equipementId}`,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // Un seul passage sur le row model: le regroupement précédent refiltrait l'intégralité des
  // lignes pour chaque client, soit un coût quadratique sur une page volontairement dense.
  const groupes = new Map<string, Row<ProvisionningLigne>[]>();
  for (const row of table.getRowModel().rows) {
    const liste = groupes.get(row.original.clientRaisonSociale);
    if (liste) liste.push(row);
    else groupes.set(row.original.clientRaisonSociale, [row]);
  }

  return (
    <>
    <BarreActionsMasse selection={selection} onDone={() => setSelection([])} />
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
        {Array.from(groupes.entries()).map(([raisonSociale, rowsDuClient]) => {
          const clientId = rowsDuClient[0]?.original.clientId;
          return (
            <Fragment key={raisonSociale}>
              <tr style={{ background: "#f0f0f0" }}>
                <td colSpan={columns.length} style={{ padding: "0.25rem", fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    {raisonSociale} —{" "}
                    {rowsDuClient.filter((r) => r.original.numeroId).length} numéro(s),{" "}
                    {rowsDuClient.filter((r) => r.original.equipementMacBrut).length} MAC,{" "}
                    {/* Une ligne de duplication (2e équipement d'un utilisateur) répète le statut
                        du même numéro: seule la ligne porteuse du numeroId est comptée. */}
                    {
                      rowsDuClient.filter(
                        (r) => r.original.numeroId && r.original.statutBascule === "Fait"
                      ).length
                    }{" "}
                    bascule(s) faite(s)
                  </span>
                  {clientId && <AjouterLigneMenu clientId={clientId} />}
                </td>
              </tr>
              {rowsDuClient.map((row) => (
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
