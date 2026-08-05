"use client";

import { useTransition } from "react";
import { PackageCheck, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statutLien, STATUT_LIEN_LABEL } from "@/lib/domain/lien/statutLien";
import {
  marquerLienCommandeAction,
  marquerLienLivreAction,
  reinitialiserLienAction,
  updateLienChampsAction,
} from "./lienActions";

const STATUT_CLASSES = {
  NON_COMMANDE: "bg-muted text-muted-foreground",
  COMMANDE: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  LIVRE: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
} as const;

export function CarteLien({
  clientId,
  scenario,
  lien,
}: {
  clientId: string;
  scenario: string | null;
  lien: {
    lienCommande: boolean;
    lienCommandeLe: string | null;
    lienCommandePar: string | null;
    lienOperateur: string | null;
    lienReference: string | null;
    lienLivraisonPrevue: string | null;
    lienLivre: boolean;
    lienLivreLe: string | null;
  };
}) {
  const [isPending, startTransition] = useTransition();
  // Un lien n'est pertinent que pour les scénarios qui en incluent un.
  const avecLien = (scenario ?? "").toLowerCase().includes("lien");
  const statut = statutLien(lien);

  if (!avecLien) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground shadow-xs">
        <span className="font-medium text-foreground">Lien opérateur</span> — pas de lien pour ce
        scénario ({scenario ?? "non renseigné"}).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Lien opérateur</span>
          <span className={cn("rounded-lg px-2.5 py-0.5 text-[11px] font-semibold", STATUT_CLASSES[statut])}>
            {STATUT_LIEN_LABEL[statut]}
          </span>
          {lien.lienCommandeLe && (
            <span className="text-xs text-muted-foreground">
              commandé le {lien.lienCommandeLe}
              {lien.lienCommandePar ? ` par ${lien.lienCommandePar}` : ""}
            </span>
          )}
          {lien.lienLivreLe && (
            <span className="text-xs text-[color:var(--pal-green-fg)]">
              livré le {lien.lienLivreLe}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!lien.lienCommande && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => { await marquerLienCommandeAction(clientId); })}
            >
              <Send data-icon="inline-start" />
              Marquer commandé
            </Button>
          )}
          {lien.lienCommande && !lien.lienLivre && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => { await marquerLienLivreAction(clientId); })}
            >
              <PackageCheck data-icon="inline-start" />
              Marquer livré
            </Button>
          )}
          {(lien.lienCommande || lien.lienLivre) && (
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              title="Réinitialiser le suivi du lien"
              onClick={() => startTransition(async () => { await reinitialiserLienAction(clientId); })}
            >
              <RotateCcw />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Opérateur</label>
          <Input
            defaultValue={lien.lienOperateur ?? ""}
            placeholder="COVAGE, Orange…"
            onBlur={(e) => {
              if (e.target.value !== (lien.lienOperateur ?? ""))
                startTransition(async () => { await updateLienChampsAction(clientId, { lienOperateur: e.target.value }); });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Référence commande</label>
          <Input
            defaultValue={lien.lienReference ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (lien.lienReference ?? ""))
                startTransition(async () => { await updateLienChampsAction(clientId, { lienReference: e.target.value }); });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Livraison prévue</label>
          <Input
            type="date"
            defaultValue={lien.lienLivraisonPrevue ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (lien.lienLivraisonPrevue ?? ""))
                startTransition(async () => { await updateLienChampsAction(clientId, { lienLivraisonPrevue: e.target.value }); });
            }}
          />
        </div>
      </div>
    </div>
  );
}
