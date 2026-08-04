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
import { CheckCheck, ChevronDown, FileX2, Inbox, Plus, Server, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { EtapeMigrationSelect } from "@/components/migration/EtapeMigrationSelect";
import {
  updateNumeroCellAction,
  forcerControleAction,
  ajouterLigneAction,
  updateEquipementMacAction,
  updateEquipementModeleAction,
  updateUtilisateurNomAction,
  actionMasseAction,
  supprimerLigneAction,
} from "./actions";

const NIVEAU_CLASSES: Record<string, string> = {
  OK: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  AVERTISSEMENT: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ERREUR: "border-transparent bg-destructive/15 text-destructive",
};

function EditableCell({
  valeurInitiale,
  onSave,
  mono = false,
  placeholder = "Saisir…",
}: {
  valeurInitiale: string;
  onSave: (valeur: string) => Promise<{ success: boolean; error?: string }>;
  mono?: boolean;
  placeholder?: string;
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

  const estVide = valeur === "";

  return (
    <div>
      <input
        value={valeur}
        placeholder={placeholder}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={enregistrer}
        onKeyDown={(e) => e.key === "Enter" && enregistrer()}
        disabled={isPending}
        className={cn(
          "w-full min-w-24 rounded-md border px-1.5 py-0.5 text-sm transition-colors outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
          // Champ vide: bordure pointillée visible pour signaler qu'il est éditable.
          // Champ rempli: bordure transparente qui apparaît au survol, pour ne pas alourdir.
          estVide
            ? "border-dashed border-input bg-muted/30"
            : "border-transparent bg-transparent hover:border-input",
          mono && "font-mono text-[13px] tabular-nums"
        )}
      />
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
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
        className={cn(
          "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm transition-colors outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
          valeurInitiale === "Fait" && "font-medium text-emerald-700 dark:text-emerald-400"
        )}
      >
        <option value=""></option>
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}

function EquipementModeleCell({
  equipementId,
  valeurInitiale,
  eligible,
  modeles,
}: {
  equipementId: string;
  valeurInitiale: string;
  eligible: boolean;
  modeles: { id: string; libelle: string; eligibleExport: boolean }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1">
      <select
        value={valeurInitiale}
        disabled={isPending}
        onChange={(e) => {
          const valeur = e.target.value;
          startTransition(async () => {
            const result = await updateEquipementModeleAction(equipementId, valeur);
            if (!result.success) {
              setErreur(result.error ?? "Échec de la sauvegarde.");
              setTimeout(() => setErreur(null), 3000);
            }
          });
        }}
        className={cn(
          "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm transition-colors outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
          valeurInitiale === "" && "text-destructive"
        )}
      >
        <option value="">— aucun modèle —</option>
        {modeles.map((m) => (
          <option key={m.id} value={m.id}>
            {m.libelle}
            {m.eligibleExport ? "" : " (non exporté)"}
          </option>
        ))}
      </select>
      {valeurInitiale !== "" && !eligible && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="shrink-0 text-xs text-amber-600" aria-label="non exporté">
                ⚠
              </span>
            }
          />
          <TooltipContent>Modèle non éligible : exclu du SDA et du MAC.</TooltipContent>
        </Tooltip>
      )}
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </div>
  );
}

function SupprimerLigneCell({ ligne }: { ligne: ProvisionningLigne }) {
  const [isPending, startTransition] = useTransition();
  // Une ligne de duplication (2e équipement sans numeroId, mais equipementId présent) reste
  // supprimable via son équipement. Une ligne totalement vide n'a rien à supprimer.
  if (!ligne.numeroId && !ligne.equipementId) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={isPending}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Supprimer la ligne"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le numéro, son équipement et son utilisateur (s&apos;il ne porte rien d&apos;autre)
            seront archivés. Ils disparaissent de la grille et des exports.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                await supprimerLigneAction({
                  numeroId: ligne.numeroId,
                  equipementId: ligne.equipementId,
                  utilisateurId: ligne.utilisateurId,
                });
              })
            }
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ControleCell({ ligne }: { ligne: ProvisionningLigne }) {
  const [isPending, startTransition] = useTransition();

  // Orphan équipement rows have no Numero, hence no Contrôle N° at all — nothing to render.
  if (!ligne.controleNiveau) return null;
  const numeroId = ligne.numeroId;

  const badge = (
    <Badge className={NIVEAU_CLASSES[ligne.controleNiveau]}>{ligne.controleNiveau}</Badge>
  );
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
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="xs" disabled={isPending}>
            <Plus data-icon="inline-start" />
            Ajouter
          </Button>
        }
      />
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
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-background/95 p-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Badge className="tabular-nums">{selection.length}</Badge>
      <span className="text-sm font-medium">
        ligne{selection.length > 1 ? "s" : ""} sélectionnée{selection.length > 1 ? "s" : ""}
      </span>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button size="sm" disabled={isPending}>
                <CheckCheck data-icon="inline-start" />
                Passer à Fait
              </Button>
            }
          />
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
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm" disabled={isPending}>
                <FileX2 data-icon="inline-start" />
                Exclure de l'export
              </Button>
            }
          />
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
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm" disabled={isPending}>
                <Undo2 data-icon="inline-start" />
                Réintégrer dans l'export
              </Button>
            }
          />
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
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEWAN">SEWAN</SelectItem>
            <SelectItem value="UNYC">UNYC</SelectItem>
          </SelectContent>
        </Select>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="outline" size="sm" disabled={isPending}>
                <Server data-icon="inline-start" />
                Affecter hébergeur cible
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer l'affectation</AlertDialogTitle>
              <AlertDialogDescription>
                Affecter l'hébergeur cible "{hebergeur}" au(x) client(s) des {selection.length}{" "}
                numéro(s) sélectionné(s) ?
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
    </div>
  );
}

function buildColumns(
  selection: string[],
  basculerSelection: (numeroId: string) => void,
  valeursStatutBascule: string[],
  modeles: { id: string; libelle: string; eligibleExport: boolean }[]
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
          mono
        />
      ) : (
        <span className="font-mono text-[13px] tabular-nums">{row.original.numeroBrut ?? ""}</span>
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
          mono
        />
      ) : (
        <span className="font-mono text-[13px] tabular-nums">
          {row.original.numerosCourts.join("/")}
        </span>
      ),
  },
  {
    header: "Contrôle N°",
    id: "controle",
    cell: ({ row }) => <ControleCell ligne={row.original} />,
  },
  {
    header: "Equipement",
    id: "equipementLibelle",
    cell: ({ row }) =>
      row.original.equipementId ? (
        <EquipementModeleCell
          key={`modele:${row.id}:${row.original.equipementModeleId ?? ""}`}
          equipementId={row.original.equipementId}
          valeurInitiale={row.original.equipementModeleId ?? ""}
          eligible={row.original.equipementEligible}
          modeles={modeles}
        />
      ) : (
        row.original.equipementLibelle ?? ""
      ),
  },
  {
    header: "Adresse MAC équipement",
    id: "equipementMacBrut",
    cell: ({ row }) =>
      row.original.equipementId ? (
        <EditableCell
          key={`equipementMacBrut:${row.id}:${row.original.equipementMacBrut ?? ""}`}
          valeurInitiale={row.original.equipementMacBrut ?? ""}
          onSave={(v) => updateEquipementMacAction(row.original.equipementId as string, v)}
          mono
        />
      ) : (
        <span className="font-mono text-[13px] tabular-nums">
          {row.original.equipementMacBrut ?? ""}
        </span>
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
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <SupprimerLigneCell ligne={row.original} />,
  },
  ];
}

export function ProvisionningTable({
  lignes,
  clientsSansLignes = [],
  valeursStatutBascule,
  modeles,
  etapesMigration,
  etapeParClient,
}: {
  lignes: ProvisionningLigne[];
  clientsSansLignes?: { id: string; raisonSociale: string }[];
  valeursStatutBascule: string[];
  modeles: { id: string; libelle: string; eligibleExport: boolean }[];
  etapesMigration: EtapeMigrationLite[];
  etapeParClient: Record<string, string | null>;
}) {
  const data = useMemo(() => lignes, [lignes]);
  const [selection, setSelection] = useState<string[]>([]);
  // Clients repliés (par raison sociale). Replier masque les lignes du client, la bande reste.
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const basculerRepli = (raisonSociale: string) => {
    setReplies((prev) => {
      const n = new Set(prev);
      if (n.has(raisonSociale)) n.delete(raisonSociale);
      else n.add(raisonSociale);
      return n;
    });
  };
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
    () => buildColumns(selection, basculerSelection, valeursStatutBascule, modeles),
    [selection, valeursStatutBascule, modeles]
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

  if (lignes.length === 0 && clientsSansLignes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Inbox className="size-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Aucune ligne à afficher</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustez les filtres ci-dessus, ou lancez une synchronisation pour importer les données.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <BarreActionsMasse selection={selection} onDone={() => setSelection([])} />
      <div
        className="overflow-x-auto rounded-[18px] border shadow-sm"
        style={{
          background: "var(--ev-card)",
          borderColor: "var(--ev-card-border)",
        }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 text-xs font-semibold whitespace-nowrap text-muted-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {Array.from(groupes.entries()).map(([raisonSociale, rowsDuClient]) => {
              const clientId = rowsDuClient[0]?.original.clientId;
              const nbNumeros = rowsDuClient.filter((r) => r.original.numeroId).length;
              const nbMac = rowsDuClient.filter((r) => r.original.equipementMacBrut).length;
              // Une ligne de duplication (2e équipement d'un utilisateur) répète le statut
              // du même numéro: seule la ligne porteuse du numeroId est comptée.
              const nbFaites = rowsDuClient.filter(
                (r) => r.original.numeroId && r.original.statutBascule === "Fait"
              ).length;
              return (
                <Fragment key={raisonSociale}>
                  <TableRow className="border-l-2 border-l-primary bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={columns.length} className="py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => basculerRepli(raisonSociale)}
                            className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={replies.has(raisonSociale) ? "Déplier" : "Replier"}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform",
                                replies.has(raisonSociale) && "-rotate-90"
                              )}
                            />
                          </button>
                          <span className="text-sm font-semibold">{raisonSociale}</span>
                          <Badge variant="outline" className="tabular-nums">
                            {nbNumeros} numéro{nbNumeros > 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="tabular-nums">
                            {nbMac} MAC
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "tabular-nums",
                              nbFaites > 0 && nbFaites === nbNumeros && NIVEAU_CLASSES.OK
                            )}
                          >
                            {nbFaites}/{nbNumeros} bascule{nbFaites > 1 ? "s" : ""} faite
                            {nbFaites > 1 ? "s" : ""}
                          </Badge>
                        </span>
                        <span className="flex items-center gap-2">
                          {clientId && (
                            <EtapeMigrationSelect
                              clientId={clientId}
                              etapeCouranteId={etapeParClient[clientId] ?? null}
                              etapes={etapesMigration}
                            />
                          )}
                          {clientId && <AjouterLigneMenu clientId={clientId} />}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {!replies.has(raisonSociale) &&
                    rowsDuClient.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        row.original.numeroId &&
                          selection.includes(row.original.numeroId) &&
                          "bg-primary/5 hover:bg-primary/10"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-1 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
            {/* Clients sans aucune ligne (issus d'un import Monday): bande cliquable pour
                démarrer la saisie via "Ligne complète". */}
            {clientsSansLignes.map((client) => (
              <TableRow
                key={`vide-${client.id}`}
                className="border-l-2 border-l-muted-foreground/30 bg-muted/30 hover:bg-muted/40"
              >
                <TableCell colSpan={columns.length} className="py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{client.raisonSociale}</span>
                      <Badge variant="outline" className="text-muted-foreground">
                        aucune ligne
                      </Badge>
                    </span>
                    <span className="flex items-center gap-2">
                      <EtapeMigrationSelect
                        clientId={client.id}
                        etapeCouranteId={etapeParClient[client.id] ?? null}
                        etapes={etapesMigration}
                      />
                      <AjouterLigneMenu clientId={client.id} />
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
