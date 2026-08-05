import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { StatutBadge } from "@/components/StatutBadge";

// Pastille d'étape de migration — délègue au badge de statut unifié du design system v2.
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
  return <StatutBadge label={etape.libelle} couleur={etape.couleur} className={className} />;
}
