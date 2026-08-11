"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, PackageCheck, Router as RouterIcon, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ArticleStockLigne } from "@/lib/domain/stock/statuts";
import { LIBELLE_STATUT } from "@/lib/domain/stock/statuts";
import type { PreparationStaging } from "@/lib/repositories/stockRepository";
import { expedierLotAction } from "./actions";

// Expédition par dossier client : le staging prépare le matériel d'un client (articles
// rattachés + config routeur), coche le dossier entier et expédie — le destinataire du
// colis se remplit tout seul dès que la sélection appartient à un seul client.
export function ExpeditionStaging({
  preparation,
  clients,
}: {
  preparation: PreparationStaging;
  clients: { id: string; raisonSociale: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [transporteur, setTransporteur] = useState("Chronopost");
  const [numeroSuivi, setNumeroSuivi] = useState("");
  const [clientManuel, setClientManuel] = useState("");
  const [scan, setScan] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement | null>(null);
  const idListe = "clients-expedition";

  const { dossiers, nonRattaches, aPreparer } = preparation;
  const tousArticles = useMemo(
    () => [...dossiers.flatMap((d) => d.articles), ...nonRattaches],
    [dossiers, nonRattaches]
  );

  // Le champ scan sert aussi de recherche : taper filtre la liste par N° de série (ou nom
  // de client), Entrée coche l'article qui correspond exactement.
  const filtre = scan.trim().toLowerCase();
  const correspond = (a: ArticleStockLigne) => a.numeroSerie.toLowerCase().includes(filtre);
  const dossiersVisibles = filtre
    ? dossiers
        .map((d) =>
          d.clientNom.toLowerCase().includes(filtre)
            ? d
            : { ...d, articles: d.articles.filter(correspond) }
        )
        .filter((d) => d.articles.length > 0)
    : dossiers;
  const nonRattachesVisibles = filtre ? nonRattaches.filter(correspond) : nonRattaches;

  // Destinataire déduit : tous les articles cochés appartiennent au même client → auto.
  const clientDeduit = useMemo(() => {
    const noms = new Set(
      [...selection].map((id) => tousArticles.find((a) => a.id === id)?.clientFinal ?? "")
    );
    return noms.size === 1 ? ([...noms][0] || null) : null;
  }, [selection, tousArticles]);
  const clientColis = clientManuel || clientDeduit || "";

  const toggle = (id: string) =>
    setSelection((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleDossier = (articles: ArticleStockLigne[]) => {
    const ids = articles.map((a) => a.id);
    const toutCoche = ids.every((id) => selection.has(id));
    setSelection((prev) => {
      const n = new Set(prev);
      for (const id of ids) {
        if (toutCoche) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  };

  // Scan douchette : coche l'article correspondant, champ vidé pour le scan suivant.
  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = scan.trim().toLowerCase();
    if (!q) return;
    const trouve = tousArticles.find((a) => a.numeroSerie.toLowerCase() === q);
    if (trouve) {
      setSelection((prev) => new Set(prev).add(trouve.id));
      setScan("");
      setErreur(null);
    } else {
      setErreur(`Aucun article en stock avec le N° série « ${scan.trim()} ».`);
      setScan("");
    }
  };

  const expedier = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await expedierLotAction([...selection], transporteur, numeroSuivi, clientColis);
      if (r.success) {
        setSelection(new Set());
        setNumeroSuivi("");
        setClientManuel("");
        router.refresh();
      } else setErreur(r.error ?? "Échec de l'expédition.");
    });
  };

  const LigneArticle = ({ a }: { a: ArticleStockLigne }) => {
    const coche = selection.has(a.id);
    return (
      <div
        onClick={() => toggle(a.id)}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 border-t px-4 py-1.5 transition-colors",
          coche ? "bg-[var(--pal-blue-bg)]/50" : "hover:bg-[var(--ev-row-hover)]"
        )}
        style={{ borderColor: "var(--ev-row-border)" }}
      >
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={coche} onCheckedChange={() => toggle(a.id)} />
        </span>
        <span className="w-52 truncate text-xs">{a.type}</span>
        <span className="font-mono text-[13px]">{a.numeroSerie}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {LIBELLE_STATUT[a.statut] ?? a.statut}
        </span>
      </div>
    );
  };

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      {/* Colis : transporteur + suivi ; le destinataire suit la sélection */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Transporteur
          <select
            value={transporteur}
            onChange={(e) => setTransporteur(e.target.value)}
            className="h-8 w-32 rounded-md border border-input bg-transparent px-2 text-sm font-normal normal-case tracking-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="Chronopost">Chronopost</option>
            <option value="DHL">DHL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          N° de suivi
          <Input
            value={numeroSuivi}
            onChange={(e) => setNumeroSuivi(e.target.value)}
            placeholder="scan ou colle…"
            className="h-8 w-40 font-mono text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Client destinataire {clientDeduit && !clientManuel && <span className="normal-case text-[color:var(--pal-green-fg)]">(auto)</span>}
          <Input
            list={idListe}
            value={clientColis}
            onChange={(e) => setClientManuel(e.target.value)}
            placeholder="suivra la sélection…"
            className="h-8 w-52 text-sm"
          />
        </label>
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={onScan}
            placeholder="Scanner ou chercher un N° de série…"
            className="h-8 w-64 pl-8 font-mono text-sm"
          />
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button onClick={expedier} disabled={isPending || selection.size === 0}>
            <PackageCheck data-icon="inline-start" />
            Expédier ({selection.size})
          </Button>
          {erreur && <span className="text-[11px] text-destructive">{erreur}</span>}
        </div>
      </div>

      {/* Dossiers par client */}
      {dossiersVisibles.length === 0 && nonRattachesVisibles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {filtre
            ? `Aucun article ni client ne correspond à « ${scan.trim()} ».`
            : "Aucun matériel en stock."}
        </p>
      ) : (
        <div className="max-h-[52vh] overflow-auto">
          {dossiersVisibles.map((d) => {
            const toutCoche = d.articles.every((a) => selection.has(a.id));
            return (
              <div key={d.clientNom}>
                <div
                  className="flex items-center gap-2.5 border-t px-4 py-2"
                  style={{ borderColor: "var(--ev-row-border)", background: "var(--ev-thead)" }}
                >
                  <Checkbox checked={toutCoche} onCheckedChange={() => toggleDossier(d.articles)} />
                  {d.clientId ? (
                    <Link href={`/clients/${d.clientId}`} className="text-[13px] font-bold hover:underline">
                      {d.clientNom}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-bold">{d.clientNom}</span>
                  )}
                  {d.dateInterventionIso && (
                    <span className="ev-badge bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">
                      <CalendarClock className="size-2.5" />
                      install {new Date(d.dateInterventionIso).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  <span
                    className={cn(
                      "ev-badge",
                      d.aConfigRouteur
                        ? "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
                        : "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
                    )}
                    title={d.aConfigRouteur ? "Configuration routeur importée" : "Pas de configuration routeur importée"}
                  >
                    <RouterIcon className="size-2.5" />
                    {d.aConfigRouteur ? "config ✓" : "config manquante"}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {d.articles.length} article{d.articles.length > 1 ? "s" : ""}
                  </span>
                </div>
                {d.articles.map((a) => (
                  <LigneArticle key={a.id} a={a} />
                ))}
              </div>
            );
          })}

          {nonRattachesVisibles.length > 0 && (
            <div>
              <div
                className="flex items-center gap-2.5 border-t px-4 py-2"
                style={{ borderColor: "var(--ev-row-border)", background: "var(--ev-thead)" }}
              >
                <span className="text-[13px] font-bold text-muted-foreground">Non rattachés</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  {nonRattachesVisibles.length} — rattacher depuis la Réception
                </span>
              </div>
              {nonRattachesVisibles.map((a) => (
                <LigneArticle key={a.id} a={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clients à préparer : intervention à venir avec lien, aucun matériel rattaché */}
      {aPreparer.length > 0 && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--ev-card-border-light)" }}>
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--pal-amber-fg)]">
            À préparer — intervention à venir, aucun matériel rattaché
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aPreparer.map((c) => (
              <Link
                key={c.clientId}
                href={`/clients/${c.clientId}`}
                className="ev-badge bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)] hover:underline"
              >
                {c.clientNom}
                {c.dateInterventionIso && ` · ${new Date(c.dateInterventionIso).toLocaleDateString("fr-FR")}`}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
