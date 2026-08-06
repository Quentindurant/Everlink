"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LigneZoho } from "@/lib/zoho/zohoClient";
import type { ZohoPullResultat } from "@/lib/zoho/syncDepuisSheet";
import { rafraichirZohoAction, synchroniserDepuisZohoAction } from "./zohoViewActions";

// Couleurs des statuts d'installation (approx. de la feuille).
function classeStatut(s: string): string {
  const t = s.trim().toUpperCase();
  if (t === "INSTALLATION") return "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]";
  if (t === "A PLANIFIER") return "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]";
  if (t.startsWith("ATT")) return "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]";
  if (t === "STAND BY") return "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]";
  if (t === "STAGING") return "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]";
  if (t === "NEW") return "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]";
  if (t === "ANNULEE") return "bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]";
  return "bg-muted text-muted-foreground";
}

const RAFRAICHIR_MS = 30_000;

export function ZohoLiveView() {
  const router = useRouter();
  const [lignes, setLignes] = useState<LigneZoho[]>([]);
  const [onglet, setOnglet] = useState("");
  const [configure, setConfigure] = useState(true);
  const [majIlYa, setMajIlYa] = useState(0);
  const [chargement, setChargement] = useState(false);
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [rapport, setRapport] = useState<ZohoPullResultat | null>(null);
  const dernierMaj = useRef(Date.now());

  const synchroniser = async () => {
    setSyncEnCours(true);
    const r = await synchroniserDepuisZohoAction();
    setRapport(r);
    setSyncEnCours(false);
    router.refresh();
  };

  const charger = useCallback(async () => {
    setChargement(true);
    const r = await rafraichirZohoAction();
    setLignes(r.lignes);
    setOnglet(r.onglet);
    setConfigure(r.configure);
    dernierMaj.current = Date.now();
    setMajIlYa(0);
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
    const refresh = setInterval(charger, RAFRAICHIR_MS);
    const tick = setInterval(() => setMajIlYa(Math.round((Date.now() - dernierMaj.current) / 1000)), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [charger]);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Tableau de suivi Zoho{onglet ? ` — ${onglet}` : ""}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {configure ? `${lignes.length} lignes · maj il y a ${majIlYa}s` : "Zoho non configuré"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={synchroniser} disabled={syncEnCours || !configure}>
            <ArrowDownToLine data-icon="inline-start" className={syncEnCours ? "animate-pulse" : ""} />
            {syncEnCours ? "Synchronisation…" : "Synchroniser vers l'app"}
          </Button>
          <Button variant="ghost" size="xs" onClick={charger} disabled={chargement}>
            <RefreshCw data-icon="inline-start" className={chargement ? "animate-spin" : ""} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {rapport && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[12.5px]",
            rapport.succes
              ? "border-[color:var(--pal-green-dot)] bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
              : "border-[color:var(--pal-amber-dot)] bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
          )}
        >
          {rapport.succes ? (
            <>
              <span className="font-semibold">Sync {rapport.onglet} :</span>
              <span>{rapport.rapproches} dossier(s) rapproché(s)</span>
              <span>· {rapport.misAJour} mis à jour</span>
              {rapport.lignesInconnues.length > 0 && (
                <span title={rapport.lignesInconnues.join(", ")}>
                  · {rapport.lignesInconnues.length} ligne(s) sans dossier (survoler pour voir)
                </span>
              )}
            </>
          ) : (
            <span>{rapport.message}</span>
          )}
        </div>
      )}

      {!configure ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Renseignez les variables ZOHO_* pour afficher le tableau de suivi en direct.
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                {["Client", "DPT", "Date", "Heure", "Tech", "Nom tech", "Installation", "Commentaires"].map((h) => (
                  <TableHead key={h} className="h-9 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium whitespace-nowrap">{l.client || "—"}</TableCell>
                  <TableCell className="tabular-nums">{l.dpt}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{l.date}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.heure}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.tech}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.nomTech}</TableCell>
                  <TableCell>
                    {l.installation && (
                      <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", classeStatut(l.installation))}>
                        {l.installation}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-80 truncate" title={l.commentaires}>{l.commentaires}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
