"use client";

import { useTransition } from "react";
import { affecterTechnicienAction } from "@/app/(app)/techniciens/actions";

export function AffectationTechnicien({
  clientId,
  technicienId,
  disponibles,
  dateIso,
  departement,
}: {
  clientId: string;
  technicienId: string | null;
  disponibles: { id: string; nom: string }[];
  dateIso: string | null;
  departement: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Technicien
      </span>
      <select
        value={technicienId ?? ""}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            await affecterTechnicienAction(clientId, e.target.value);
          })
        }
        className="rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
      >
        <option value="">— non affecté —</option>
        {disponibles.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nom}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        {dateIso
          ? `disponibles le ${new Date(dateIso).toLocaleDateString("fr-FR")}${departement ? ` · dép. ${departement}` : ""}`
          : "renseignez une date d'intervention pour filtrer par disponibilité"}
      </span>
    </div>
  );
}
