import { pastelBg, pastelFg } from "@/components/migration/pastel";

// Familles de teintes du design system v2 (vue "Système de statuts" de la maquette).
export type PalNom =
  | "gray"
  | "blue"
  | "cyan"
  | "violet"
  | "amber"
  | "red"
  | "green"
  | "teal";

// Pastille de statut unifiée : pastel (fond doux, texte foncé teinté, point saturé).
// Deux modes: `pal` (teinte du design system) ou `couleur` (hex libre venu du seed).
export function StatutBadge({
  label,
  pal,
  couleur,
  count,
  bold = false,
  className = "",
}: {
  label: string;
  pal?: PalNom;
  couleur?: string;
  count?: number;
  bold?: boolean;
  className?: string;
}) {
  const style = pal
    ? {
        background: `var(--pal-${pal}-bg)`,
        color: `var(--pal-${pal}-fg)`,
      }
    : couleur
      ? { background: pastelBg(couleur), color: pastelFg(couleur) }
      : { background: "var(--pal-gray-bg)", color: "var(--pal-gray-fg)" };
  const dot = pal ? `var(--pal-${pal}-dot)` : couleur ?? "var(--pal-gray-dot)";
  return (
    <span className={`ev-badge ${bold ? "font-bold" : ""} ${className}`} style={style}>
      <span className="ev-badge-dot" style={{ background: dot }} />
      {label}
      {count !== undefined && (
        <span className="rounded bg-black/10 px-1 font-mono tabular-nums">{count}</span>
      )}
    </span>
  );
}
