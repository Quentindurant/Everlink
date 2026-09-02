"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RefreshCw, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FriseColis } from "@/components/FriseColis";
import { useRafraichissementAuto } from "@/components/useRafraichissementAuto";
import { transporteurAvecSuiviApi } from "@/lib/domain/tracking/laposte";
import { BarreRecherche, correspond } from "@/components/BarreRecherche";
import type { ColisExpedie } from "@/lib/repositories/stockRepository";
import {
  annulerExpeditionAction,
  annulerInstallationAction,
  avancerStatutAction,
  corrigerColisAction,
  rafraichirSuiviColisAction,
} from "./actions";

// Puce d'un article expédié : clic pour marquer installé, re-clic pour annuler si erreur.
// La croix retire l'article du colis (il revient « En stock »).
function ArticlePuce({
  id,
  numeroSerie,
  type,
  statut,
}: {
  id: string;
  numeroSerie: string;
  type: string;
  statut: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const installe = statut === "INSTALLE";
  return (
    <span
      className="inline-flex items-center rounded-lg border font-mono text-[11px]"
      style={{ borderColor: "var(--ev-card-border)" }}
    >
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            if (installe) await annulerInstallationAction(id);
            else await avancerStatutAction(id);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1 px-2 py-0.5 hover:bg-muted"
        title={
          installe
            ? `${type} · installé — cliquer pour annuler`
            : `${type} · cliquer pour marquer installé`
        }
      >
        {numeroSerie}
        {installe && <Check className="size-3 text-[color:var(--pal-green-fg)]" />}
      </button>
      {!installe && (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await annulerExpeditionAction([id]);
              router.refresh();
            })
          }
          className="border-l px-1 py-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          style={{ borderColor: "var(--ev-card-border)" }}
          title="Retirer cet article du colis (retour en stock)"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

// Historique des expéditions, un bloc par colis (numéro de suivi), façon HighStock.
// Chaque colis se corrige (transporteur, n° de suivi, destinataire) ou s'annule en entier.
export function HistoriqueColis({ colis }: { colis: ColisExpedie[] }) {
  useRafraichissementAuto();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editionCle, setEditionCle] = useState<string | null>(null);
  const [transporteur, setTransporteur] = useState("");
  const [numeroSuivi, setNumeroSuivi] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [confirmationCle, setConfirmationCle] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  // Filtre local sur le destinataire, le transporteur, le N° de suivi et les N° de série
  // des articles du colis — c'est par l'un de ces quatre qu'on retrouve une expédition.
  const visibles = useMemo(
    () =>
      colis.filter((c) =>
        correspond(
          [
            c.clientFinal,
            c.transporteur,
            c.numeroSuivi,
            c.suiviLibelle,
            ...c.articles.map((a) => a.numeroSerie),
            ...c.articles.map((a) => a.type),
          ],
          recherche
        )
      ),
    [colis, recherche]
  );

  const ouvrirEdition = (c: ColisExpedie) => {
    setEditionCle(c.cle);
    setTransporteur(c.transporteur ?? "Chronopost");
    setNumeroSuivi(c.numeroSuivi ?? "");
    setClientNom(c.clientFinal ?? "");
    setErreur(null);
  };

  const enregistrer = (c: ColisExpedie) => {
    startTransition(async () => {
      const r = await corrigerColisAction(
        c.articles.map((a) => a.id),
        transporteur,
        numeroSuivi,
        clientNom
      );
      if (r.success) {
        setEditionCle(null);
        router.refresh();
      } else setErreur(r.error ?? "Échec de la correction.");
    });
  };

  return (
    <div>
      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Client, transporteur, N° de suivi, N° de série…"
        nbVisibles={visibles.length}
        nbTotal={colis.length}
      />
      {colis.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune expédition pour l&apos;instant.
        </p>
      ) : visibles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun colis ne correspond à cette recherche.
        </p>
      ) : (
        <div className="flex flex-col">
          {visibles.map((c) => {
            const enEdition = editionCle === c.cle;
            const toutInstalle = c.articles.every((a) => a.statut === "INSTALLE");
            return (
              <div
                key={c.cle}
                className="border-t px-4 py-3 first:border-t-0"
                style={{ borderColor: "var(--ev-card-border-light)" }}
              >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <div className="min-w-[180px]">
                    <div className="text-[13px] font-semibold">{c.clientFinal ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.dateEnvoi
                        ? `envoyé le ${new Date(c.dateEnvoi).toLocaleDateString("fr-FR")}`
                        : "date d'envoi inconnue"}
                    </div>
                  </div>

                  <FriseColis
                    compact
                    etape={c.suiviEtape}
                    libelle={c.suiviLibelle}
                    livreLe={c.suiviLivreLe}
                    numeroSuivi={c.numeroSuivi}
                    transporteur={c.transporteur}
                  />

                  {/* Suivi temps réel Chronopost : dernier événement La Poste + actualisation
                      à la demande (le cron rafraîchit sinon toutes les 2 h). */}
                  {c.numeroSuivi && transporteurAvecSuiviApi(c.transporteur) && (
                    <span className="flex min-w-0 max-w-72 items-center gap-1.5">
                      {c.suiviLibelle && (
                        <span
                          className="truncate text-[11.5px] text-muted-foreground"
                          title={c.suiviLibelle}
                        >
                          {c.suiviLibelle}
                        </span>
                      )}
                      <button
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await rafraichirSuiviColisAction(
                              c.articles.map((a) => a.id),
                              c.numeroSuivi ?? ""
                            );
                            if (!r.success) setErreur(r.error ?? "Échec du relevé.");
                            else router.refresh();
                          })
                        }
                        className="shrink-0 rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
                        title="Relever l'état du colis maintenant"
                      >
                        <RefreshCw className={cn("size-3", isPending && "animate-spin")} />
                      </button>
                    </span>
                  )}

                  <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                    {c.articles.map((a) => (
                      <ArticlePuce
                        key={a.id}
                        id={a.id}
                        numeroSerie={a.numeroSerie}
                        type={a.type}
                        statut={a.statut}
                      />
                    ))}

                    <button
                      onClick={() => (enEdition ? setEditionCle(null) : ouvrirEdition(c))}
                      className="rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
                      title="Corriger le colis (transporteur, n° de suivi, destinataire)"
                    >
                      <Pencil className="size-3" />
                    </button>
                    {!toutInstalle &&
                      (confirmationCle === c.cle ? (
                        <button
                          onClick={() =>
                            startTransition(async () => {
                              await annulerExpeditionAction(c.articles.map((a) => a.id));
                              setConfirmationCle(null);
                              router.refresh();
                            })
                          }
                          disabled={isPending}
                          onMouseLeave={() => setConfirmationCle(null)}
                          className="rounded-lg border border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive"
                        >
                          Annuler l&apos;expédition ?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmationCle(c.cle)}
                          className="rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Annuler l'expédition — tout le colis revient en stock"
                        >
                          <Undo2 className="size-3" />
                        </button>
                      ))}
                  </div>
                </div>

                {/* Correction du colis : mêmes champs qu'à l'expédition */}
                {enEdition && (
                  <div className="mt-2 flex flex-wrap items-end gap-3">
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
                        className="h-8 w-40 font-mono text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Client destinataire
                      <Input
                        value={clientNom}
                        onChange={(e) => setClientNom(e.target.value)}
                        className="h-8 w-52 text-sm"
                      />
                    </label>
                    <Button onClick={() => enregistrer(c)} disabled={isPending} size="sm">
                      <Check data-icon="inline-start" />
                      Enregistrer
                    </Button>
                    <Button onClick={() => setEditionCle(null)} variant="outline" size="sm">
                      Annuler
                    </Button>
                    {erreur && <span className="text-[11px] text-destructive">{erreur}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
