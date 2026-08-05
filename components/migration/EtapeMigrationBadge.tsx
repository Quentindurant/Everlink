import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { pastelBg, pastelFg } from "./pastel";

// Pastille pastel façon design system v2: fond doux, texte foncé teinté, point saturé.
export function EtapeMigrationBadge({
  etape,
  className = "",
}: {
  etape: Pick<EtapeMigrationLite, "libelle" | "couleur"> | null;
  className?: string;
}) {
  if (!etape) {
    return (
      <span
        className={`ev-badge border border-dashed text-muted-foreground ${className}`}
      >
        Sans étape
      </span>
    );
  }
  return (
    <span
      className={`ev-badge ${className}`}
      style={{ background: pastelBg(etape.couleur), color: pastelFg(etape.couleur) }}
    >
      <span className="ev-badge-dot" style={{ background: etape.couleur }} />
      {etape.libelle}
    </span>
  );
}
