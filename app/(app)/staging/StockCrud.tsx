"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, ScanLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleStockLigne } from "@/lib/domain/stock/statuts";
import { LIBELLE_STATUT } from "@/lib/domain/stock/statuts";
import {
  ajouterArticleAction,
  avancerStatutAction,
  rattacherClientAction,
  supprimerArticleAction,
  updateArticleAction,
} from "./actions";

const COULEUR_STATUT: Record<string, string> = {
  EN_STOCK: "bg-muted text-muted-foreground",
  CONFIGURE: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  RETOUR: "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]",
};

// Champ texte inline sauvegardé au blur.
function CelluleEditable({
  valeur,
  mono = false,
  largeur = "w-40",
  onSave,
}: {
  valeur: string;
  mono?: boolean;
  largeur?: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(valeur);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() && v !== valeur) onSave(v);
        else setV(valeur);
      }}
      className={cn(
        largeur,
        mono && "font-mono",
        "rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] outline-none hover:border-input focus:border-ring"
      )}
    />
  );
}

function LigneStock({ a, listeClients }: { a: ArticleStockLigne; listeClients: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const agir = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <tr
      className={cn("border-t transition-colors hover:bg-[var(--ev-row-hover)]", isPending && "opacity-50")}
      style={{ borderColor: "var(--ev-row-border)" }}
    >
      <td className="px-3 py-1">
        <CelluleEditable
          valeur={a.type}
          largeur="w-44"
          onSave={(v) => agir(() => updateArticleAction(a.id, "type", v))}
        />
      </td>
      <td className="px-3 py-1">
        <CelluleEditable
          valeur={a.numeroSerie}
          mono
          largeur="w-44"
          onSave={(v) => agir(() => updateArticleAction(a.id, "numeroSerie", v))}
        />
      </td>
      <td className="px-3 py-1">
        <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-semibold", COULEUR_STATUT[a.statut] ?? "bg-muted")}>
          {LIBELLE_STATUT[a.statut] ?? a.statut}
        </span>
        {a.origine === "CLIENT" && (
          <span className="ml-1 text-[10px] text-muted-foreground">récupéré</span>
        )}
      </td>
      <td className="px-3 py-1">
        <Input
          list={listeClients}
          defaultValue={a.clientFinal ?? ""}
          placeholder="client…"
          className="h-7 w-40 text-xs"
          onBlur={(e) => {
            if (e.target.value !== (a.clientFinal ?? "")) {
              agir(() => rattacherClientAction(a.id, e.target.value));
            }
          }}
        />
      </td>
      <td className="px-3 py-1 text-xs tabular-nums text-muted-foreground">
        {a.dateReception ? new Date(a.dateReception).toLocaleDateString("fr-FR") : "—"}
      </td>
      <td className="px-3 py-1">
        <div className="flex items-center gap-1">
          {a.statut === "EN_STOCK" && (
            <button
              onClick={() => agir(() => avancerStatutAction(a.id))}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
              title="Marquer configuré"
            >
              Configuré
              <ArrowRight className="size-3" />
            </button>
          )}
          <button
            onClick={() => agir(() => supprimerArticleAction(a.id))}
            className="rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Archiver"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// CRUD du stock : ajout en rafale à la douchette (type mémorisé, scan → Entrée → ajouté,
// focus conservé), édition inline, passage en configuré, archivage.
export function StockCrud({
  articles,
  types,
  clients,
}: {
  articles: ArticleStockLigne[];
  types: string[];
  clients: { id: string; raisonSociale: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("Routeur 4G seul");
  const [serie, setSerie] = useState("");
  const [filtre, setFiltre] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const serieRef = useRef<HTMLInputElement | null>(null);
  const idListe = "clients-stock-crud";
  const idTypes = "types-stock-crud";

  const ajouter = () => {
    const s = serie.trim();
    if (!s) return;
    startTransition(async () => {
      const r = await ajouterArticleAction(type, s);
      setMessage(r.success ? { ok: true, texte: `${s} ajouté` } : { ok: false, texte: r.error ?? "Échec." });
      if (r.success) {
        setSerie("");
        router.refresh();
      }
      serieRef.current?.focus();
    });
  };

  const q = filtre.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      q
        ? articles.filter(
            (a) =>
              a.numeroSerie.toLowerCase().includes(q) ||
              a.type.toLowerCase().includes(q) ||
              (a.clientFinal ?? "").toLowerCase().includes(q)
          )
        : articles,
    [articles, q]
  );

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>
      <datalist id={idTypes}>
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {/* Ajout en rafale : le type reste, on scanne les séries les unes après les autres */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Input
          list={idTypes}
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="type / modèle"
          className="h-9 w-52 text-sm"
        />
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={serieRef}
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ajouter()}
            placeholder="Scanner un N° de série…"
            autoFocus
            className="h-9 w-64 pl-8 font-mono text-sm"
          />
        </div>
        <Button onClick={ajouter} disabled={isPending || !serie.trim()}>
          <Plus data-icon="inline-start" />
          Ajouter
        </Button>
        {message && (
          <span
            className={cn(
              "text-sm font-medium",
              message.ok ? "text-[color:var(--pal-green-fg)]" : "text-destructive"
            )}
          >
            {message.texte}
          </span>
        )}
      </div>

      {/* Filtre + table éditable */}
      <div
        className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        <Input
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer…"
          className="h-8 w-56 text-sm"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {visibles.length} / {articles.length} articles
        </span>
      </div>

      <div className="max-h-[48vh] overflow-auto">
        {visibles.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun article.</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-[var(--ev-thead)]">
              <tr>
                {["Type", "N° série", "Statut", "Client rattaché", "Reçu le", ""].map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[.06em]"
                    style={{ color: "var(--ev-th)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <LigneStock key={a.id} a={a} listeClients={idListe} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
