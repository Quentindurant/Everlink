"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArticleStockLigne } from "@/lib/domain/stock/statuts";
import { LIBELLE_STATUT, STATUT_SUIVANT, STATUTS_STOCK } from "@/lib/domain/stock/statuts";
import {
  ajouterRetourAction,
  avancerStatutAction,
  rattacherClientAction,
  supprimerArticleAction,
} from "./actions";

const COULEUR_STATUT: Record<string, string> = {
  EN_STOCK: "bg-muted text-muted-foreground",
  CONFIGURE: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  ENVOYE: "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
  INSTALLE: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
  RETOUR: "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]",
};

function LigneArticle({ a, listeClients }: { a: ArticleStockLigne; listeClients: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const suivant = STATUT_SUIVANT[a.statut];

  const agir = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <TableRow className={cn(isPending && "opacity-50")}>
      <TableCell className="whitespace-nowrap text-xs">{a.type}</TableCell>
      <TableCell className="font-mono text-[13px]">{a.numeroSerie}</TableCell>
      <TableCell>
        <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-semibold", COULEUR_STATUT[a.statut])}>
          {LIBELLE_STATUT[a.statut] ?? a.statut}
        </span>
        {a.origine === "CLIENT" && (
          <span className="ml-1 text-[10px] text-muted-foreground">récupéré</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{a.etatAppareil ?? "—"}</TableCell>
      <TableCell>
        <Input
          list={listeClients}
          defaultValue={a.clientFinal ?? ""}
          placeholder="client…"
          className="h-7 w-44 text-xs"
          onBlur={(e) => {
            if (e.target.value !== (a.clientFinal ?? "")) {
              agir(() => rattacherClientAction(a.id, e.target.value));
            }
          }}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {suivant && (
            <button
              onClick={() => agir(() => avancerStatutAction(a.id))}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
              title={`Passer à « ${LIBELLE_STATUT[suivant]} »`}
            >
              {LIBELLE_STATUT[suivant]}
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
      </TableCell>
    </TableRow>
  );
}

function RetourForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("");
  const [serie, setSerie] = useState("");
  const [client, setClient] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await ajouterRetourAction(type, serie, client);
      if (r.success) {
        setType("");
        setSerie("");
        setClient("");
        router.refresh();
      } else setErreur(r.error ?? "Échec.");
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Undo2 className="size-4" />
        Routeur récupéré chez le client
      </div>
      <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="type / modèle" className="h-8 w-40 text-sm" />
      <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="n° série" className="h-8 w-44 text-sm" />
      <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="client" className="h-8 w-40 text-sm" />
      <Button size="sm" onClick={enregistrer} disabled={isPending || !serie.trim()}>
        {isPending ? "…" : "Enregistrer le retour"}
      </Button>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
    </div>
  );
}

export function StockTable({
  articles,
  types,
  clients,
  filtreType,
  filtreStatut,
}: {
  articles: ArticleStockLigne[];
  types: string[];
  clients: { id: string; raisonSociale: string }[];
  filtreType: string;
  filtreStatut: string;
}) {
  const router = useRouter();
  const idListe = "clients-stock";

  const filtrer = (cle: "type" | "statut", valeur: string) => {
    const params = new URLSearchParams();
    const type = cle === "type" ? valeur : filtreType;
    const statut = cle === "statut" ? valeur : filtreStatut;
    if (type) params.set("type", type);
    if (statut) params.set("statut", statut);
    router.push(`/staging${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      <RetourForm />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtreType}
          onChange={(e) => filtrer("type", e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filtreStatut}
          onChange={(e) => filtrer("statut", e.target.value)}
          className="h-8 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          {STATUTS_STOCK.map((s) => (
            <option key={s} value={s}>{LIBELLE_STATUT[s]}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground tabular-nums">{articles.length} articles</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Type", "N° série", "Statut", "État", "Client final", "Action"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Aucun article. Importez le fichier de stock ci-dessus.
                </TableCell>
              </TableRow>
            ) : (
              articles.map((a) => <LigneArticle key={a.id} a={a} listeClients={idListe} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
