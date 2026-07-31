"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { setEtapeMigrationAction } from "@/app/(app)/clients/actions";

// Sélecteur d'étape sous forme de pastille colorée cliquable. Le fond prend la couleur de
// l'étape courante pour rester "impactant au regard" même en mode compact (grille).
export function EtapeMigrationSelect({
  clientId,
  etapeCouranteId,
  etapes,
}: {
  clientId: string;
  etapeCouranteId: string | null;
  etapes: EtapeMigrationLite[];
}) {
  const [isPending, startTransition] = useTransition();
  const courante = etapes.find((e) => e.id === etapeCouranteId) ?? null;

  return (
    <select
      value={etapeCouranteId ?? ""}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await setEtapeMigrationAction(clientId, e.target.value);
        })
      }
      className={cn(
        "rounded-lg border-0 px-2.5 py-1 text-[11px] font-semibold outline-none transition-opacity focus:ring-2 focus:ring-ring/40 disabled:opacity-50",
        courante ? "text-white" : "border border-dashed text-muted-foreground"
      )}
      style={courante ? { background: courante.couleur } : undefined}
    >
      {!etapeCouranteId && <option value="">Sans étape</option>}
      {etapes.map((etape) => (
        <option key={etape.id} value={etape.id} className="bg-white text-foreground">
          {etape.libelle}
        </option>
      ))}
    </select>
  );
}
