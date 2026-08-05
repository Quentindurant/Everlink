import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { pastelBg, pastelFg } from "./pastel";

// Stepper horizontal du parcours. Les étapes bloquantes sont sorties de la ligne nominale
// (affichées à part) pour ne pas rompre l'ordre de progression.
export function EtapeMigrationStepper({
  etapes,
  etapeCouranteId,
}: {
  etapes: EtapeMigrationLite[];
  etapeCouranteId: string | null;
}) {
  const nominales = etapes.filter((e) => !e.estBloquant);
  const bloquantes = etapes.filter((e) => e.estBloquant);
  const courante = etapes.find((e) => e.id === etapeCouranteId) ?? null;
  const estBloque = courante?.estBloquant ?? false;
  const ordreCourant = courante?.ordre ?? -1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {nominales.map((etape, i) => {
          const passee = !estBloque && etape.ordre < ordreCourant;
          const active = !estBloque && etape.id === etapeCouranteId;
          return (
            <div key={etape.id} className="flex items-center gap-1">
              <div
                className={cn(
                  "ev-badge transition-colors",
                  active && "font-bold",
                  !active && !passee && "bg-muted text-muted-foreground"
                )}
                style={
                  active || passee
                    ? { background: pastelBg(etape.couleur), color: pastelFg(etape.couleur) }
                    : undefined
                }
              >
                {passee ? (
                  <Check className="size-3" />
                ) : (
                  <span
                    className="ev-badge-dot"
                    style={{
                      background: active ? etape.couleur : "var(--pal-gray-dot)",
                    }}
                  />
                )}
                {etape.libelle}
              </div>
              {i < nominales.length - 1 && (
                <span className="text-muted-foreground/40">›</span>
              )}
            </div>
          );
        })}
      </div>
      {estBloque && courante && (
        <div
          className="ev-badge w-fit font-bold"
          style={{ background: pastelBg(courante.couleur), color: pastelFg(courante.couleur) }}
        >
          <span className="ev-badge-dot" style={{ background: courante.couleur }} />
          ⚠ {courante.libelle}
        </div>
      )}
      {!estBloque && bloquantes.length > 0 && null}
    </div>
  );
}
