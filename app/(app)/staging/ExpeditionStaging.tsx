"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ArticleStockLigne } from "@/lib/domain/stock/statuts";
import { LIBELLE_STATUT } from "@/lib/domain/stock/statuts";
import { expedierLotAction } from "./actions";

// Bloc « Nouvelle expédition » façon HighStock : on saisit le colis une fois (transporteur,
// numéro de suivi, client), on scanne/coche le matériel en stock, puis on expédie le lot.
export function ExpeditionStaging({
  articles,
  clients,
  types,
}: {
  articles: ArticleStockLigne[];
  clients: { id: string; raisonSociale: string }[];
  types: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [transporteur, setTransporteur] = useState("Chronopost");
  const [numeroSuivi, setNumeroSuivi] = useState("");
  const [client, setClient] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [scan, setScan] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement | null>(null);
  const idListe = "clients-expedition";

  const visibles = useMemo(
    () => (filtreType ? articles.filter((a) => a.type === filtreType) : articles),
    [articles, filtreType]
  );

  const toggle = (id: string) =>
    setSelection((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Scan douchette : la douchette tape le N° série + Entrée. On coche l'article correspondant
  // et on vide le champ, prêt pour le scan suivant.
  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = scan.trim().toLowerCase();
    if (!q) return;
    const trouve = articles.find((a) => a.numeroSerie.toLowerCase() === q);
    if (trouve) {
      setSelection((prev) => new Set(prev).add(trouve.id));
      setScan("");
    } else {
      setErreur(`Aucun article en stock avec le N° série « ${scan.trim()} ».`);
      setScan("");
    }
  };

  const toutCocher = () => {
    if (selection.size === visibles.length) setSelection(new Set());
    else setSelection(new Set(visibles.map((a) => a.id)));
  };

  const expedier = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await expedierLotAction([...selection], transporteur, numeroSuivi, client);
      if (r.success) {
        setSelection(new Set());
        setNumeroSuivi("");
        setClient("");
        router.refresh();
      } else setErreur(r.error ?? "Échec de l'expédition.");
    });
  };

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      {/* En-tête du colis : saisi une seule fois pour tout le lot */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Transporteur
          <Input
            value={transporteur}
            onChange={(e) => setTransporteur(e.target.value)}
            className="h-8 w-36 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          N° de suivi
          <Input
            value={numeroSuivi}
            onChange={(e) => setNumeroSuivi(e.target.value)}
            placeholder="scan ou colle…"
            className="h-8 w-44 font-mono text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Client destinataire
          <Input
            list={idListe}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="raison sociale…"
            className="h-8 w-52 text-sm"
          />
        </label>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button onClick={expedier} disabled={isPending || selection.size === 0}>
            <PackageCheck data-icon="inline-start" />
            Expédier la sélection ({selection.size})
          </Button>
          {erreur && <span className="text-[11px] text-destructive">{erreur}</span>}
        </div>
      </div>

      {/* Barre de scan + filtre du matériel à expédier */}
      <div
        className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={onScan}
            placeholder="Scanner un N° de série…"
            className="h-8 w-64 pl-8 font-mono text-sm"
          />
        </div>
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={toutCocher}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          {selection.size === visibles.length && visibles.length > 0 ? "Tout décocher" : "Tout cocher"}
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selection.size} sélectionné(s) · {visibles.length} en stock
        </span>
      </div>

      {/* Liste sélectionnable du matériel à expédier */}
      <div className="max-h-[42vh] overflow-auto">
        {visibles.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun matériel en stock.
          </p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-[var(--ev-thead)]">
              <tr>
                <th className="w-10 px-3 py-2" />
                {["Type", "N° série", "Statut", "Client rattaché"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[.06em]"
                    style={{ color: "var(--ev-th)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const coche = selection.has(a.id);
                return (
                  <tr
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={cn(
                      "cursor-pointer border-t transition-colors",
                      coche ? "bg-[var(--pal-blue-bg)]/50" : "hover:bg-[var(--ev-row-hover)]"
                    )}
                    style={{ borderColor: "var(--ev-row-border)" }}
                  >
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={coche} onCheckedChange={() => toggle(a.id)} />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-xs">{a.type}</td>
                    <td className="px-3 py-1.5 font-mono text-[13px]">{a.numeroSerie}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {LIBELLE_STATUT[a.statut] ?? a.statut}
                    </td>
                    <td className="px-3 py-1.5 text-xs">{a.clientFinal ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
