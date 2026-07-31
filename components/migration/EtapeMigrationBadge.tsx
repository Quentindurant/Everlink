import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";

// Pastille pleine à la couleur de l'étape. Texte blanc, lisible sur toutes les couleurs du seed.
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
        className={`inline-flex items-center rounded-lg border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${className}`}
      >
        Sans étape
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-semibold text-white ${className}`}
      style={{ background: etape.couleur }}
    >
      {etape.libelle}
    </span>
  );
}
