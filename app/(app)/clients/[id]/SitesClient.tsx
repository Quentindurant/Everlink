"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopiePuce } from "@/components/CopiePuce";
import { renommerSiteAction } from "./siteActions";

export interface SiteLigne {
  id: string;
  nom: string;
  adresse: string | null;
  dateInterventionIso: string | null;
  creneau: string | null;
  contact: string | null;
  telephone: string | null;
  email: string | null;
  nbPostesAnnonce: number | null;
  nbPostes: number;
  principal: boolean;
}

// Un client multi-établissements : une carte par adresse. La téléphonie reste commune
// (les postes s'appellent entre eux), seules les interventions sont propres à chaque site.
export function SitesClient({ sites }: { sites: SiteLigne[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editionId, setEditionId] = useState<string | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sites.map((s) => (
        <div
          key={s.id}
          className="flex flex-col gap-2 rounded-lg border p-3"
          style={{ borderColor: "var(--ev-card-border)" }}
        >
          <div className="flex items-center gap-1.5">
            {s.principal && (
              <Star
                className="size-3 shrink-0 text-[color:var(--pal-amber-fg)]"
                aria-label="Site principal"
              />
            )}
            {editionId === s.id ? (
              <input
                defaultValue={s.nom}
                autoFocus
                onBlur={(e) => {
                  setEditionId(null);
                  if (e.target.value.trim() && e.target.value !== s.nom)
                    startTransition(async () => {
                      await renommerSiteAction(s.id, e.target.value);
                      router.refresh();
                    });
                }}
                className="w-full rounded-md border border-input bg-transparent px-1.5 py-0.5 text-[13px] font-bold outline-none focus:border-ring"
              />
            ) : (
              <button
                onClick={() => setEditionId(s.id)}
                className={cn("text-[13px] font-bold hover:underline", isPending && "opacity-50")}
                title="Renommer le site"
              >
                {s.nom}
              </button>
            )}
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
              {s.nbPostes}
              {s.nbPostesAnnonce ? `/${s.nbPostesAnnonce}` : ""} poste
              {s.nbPostes > 1 ? "s" : ""}
            </span>
          </div>

          {s.adresse && (
            <div className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <span>{s.adresse}</span>
            </div>
          )}

          {s.dateInterventionIso && (
            <span className="ev-badge w-fit bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">
              <CalendarClock className="size-2.5" />
              {new Date(s.dateInterventionIso).toLocaleDateString("fr-FR")}
              {s.creneau ? ` · ${s.creneau}` : ""}
            </span>
          )}

          {(s.contact || s.telephone || s.email) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {s.contact && <span>{s.contact}</span>}
              {s.telephone && <CopiePuce valeur={s.telephone} titre="Téléphone du site" />}
              {s.email && <CopiePuce valeur={s.email} titre="Email du site" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
