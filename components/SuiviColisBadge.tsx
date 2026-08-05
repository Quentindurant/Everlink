import { LIBELLE_SUIVI, PAL_SUIVI, type SuiviStatut } from "@/lib/domain/tracking/laposte";

// Pastille d'état d'un colis (En cours / Livré / Inconnu), teintes du design system.
// Le libellé La Poste brut ("Pris en charge…", "Votre colis est livré") est en title/tooltip.
export function SuiviColisBadge({
  statut,
  libelle,
  numeroSuivi,
  transporteur,
}: {
  statut: string | null;
  libelle: string | null;
  numeroSuivi: string | null;
  transporteur: string | null;
}) {
  if (!numeroSuivi) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const s = (statut as SuiviStatut) || "INCONNU";
  const pal = PAL_SUIVI[s] ?? "gray";
  return (
    <span className="inline-flex flex-col gap-0.5" title={libelle ?? undefined}>
      <span
        className="ev-badge w-fit"
        style={{ background: `var(--pal-${pal}-bg)`, color: `var(--pal-${pal}-fg)` }}
      >
        <span className="ev-badge-dot" style={{ background: `var(--pal-${pal}-dot)` }} />
        {LIBELLE_SUIVI[s] ?? "Suivi"}
      </span>
      <span className="font-mono text-[10.5px]" style={{ color: "var(--ev-text-tertiary)" }}>
        {transporteur ? `${transporteur} · ` : ""}
        {numeroSuivi}
      </span>
    </span>
  );
}
