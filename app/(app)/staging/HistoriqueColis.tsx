"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { SuiviColisBadge } from "@/components/SuiviColisBadge";
import type { ColisExpedie } from "@/lib/repositories/stockRepository";
import { avancerStatutAction } from "./actions";

// Puce d'un article expédié : N° série cliquable pour marquer l'installation (ENVOYE → INSTALLE).
function ArticlePuce({ id, numeroSerie, type, statut }: { id: string; numeroSerie: string; type: string; statut: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const installe = statut === "INSTALLE";
  return (
    <button
      disabled={installe || isPending}
      onClick={() =>
        startTransition(async () => {
          await avancerStatutAction(id);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[11px] enabled:hover:bg-muted disabled:cursor-default"
      style={{ borderColor: "var(--ev-card-border)" }}
      title={installe ? `${type} · installé` : `${type} · cliquer pour marquer installé`}
    >
      {numeroSerie}
      {installe && <Check className="size-3 text-[color:var(--pal-green-fg)]" />}
    </button>
  );
}

// Historique des expéditions, un bloc par colis (numéro de suivi), façon HighStock.
export function HistoriqueColis({ colis }: { colis: ColisExpedie[] }) {
  return (
    <div>
      {colis.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune expédition pour l&apos;instant.
        </p>
      ) : (
        <div className="flex flex-col">
          {colis.map((c) => (
            <div
              key={c.cle}
              className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t px-4 py-3 first:border-t-0"
              style={{ borderColor: "var(--ev-card-border-light)" }}
            >
              <div className="min-w-[180px]">
                <div className="text-[13px] font-semibold">{c.clientFinal ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.dateEnvoi
                    ? `envoyé le ${new Date(c.dateEnvoi).toLocaleDateString("fr-FR")}`
                    : "date d'envoi inconnue"}
                </div>
              </div>

              <SuiviColisBadge
                statut={c.suiviStatut}
                libelle={c.suiviLibelle}
                numeroSuivi={c.numeroSuivi}
                transporteur={c.transporteur}
              />

              <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                {c.articles.map((a) => (
                  <ArticlePuce key={a.id} id={a.id} numeroSerie={a.numeroSerie} type={a.type} statut={a.statut} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
