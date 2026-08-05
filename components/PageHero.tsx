"use client";

type Kpi = {
  value: string | number;
  label: string;
  color?: string;
};

// Topbar claire du design system v2 : carré accent + titre à gauche,
// KPIs compacts + recherche (palette ⌘K) à droite. Se colle en haut de page
// via marges négatives (toutes les pages partagent le wrapper `main p-5`).
export function PageHero({
  accentColor = "var(--ev-blue)",
  label,
  title,
  description,
  kpis = [],
}: {
  accentColor?: string;
  label: string;
  title: string;
  description?: string;
  kpis?: Kpi[];
}) {
  // `description` volontairement non rendu: bandeau compact (retour utilisateur "trop de mots").
  // Le titre peut porter un <br /> hérité de l'ancienne version verbeuse: on l'aplatit.
  void description;
  const titrePlat = title.replace(/<br\s*\/?>/gi, " ");
  return (
    <div
      className="sticky top-0 z-20 -mx-5 -mt-5 flex min-h-[52px] flex-wrap items-center gap-x-5 gap-y-2 border-b bg-white px-5 py-2"
      style={{ borderColor: "var(--ev-sidebar-border)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[9px]">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ background: accentColor }}
        />
        <h1
          className="truncate text-[15px] font-bold leading-none"
          style={{ color: "var(--ev-body)" }}
        >
          {titrePlat}
        </h1>
        <span
          className="hidden text-[10.5px] font-semibold uppercase tracking-[.07em] sm:inline"
          style={{ color: "var(--ev-text-tertiary)" }}
        >
          {label}
        </span>
      </div>
      {kpis.length > 0 && (
        <div className="flex items-center">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className="flex items-baseline gap-1.5 border-l px-3.5 first:border-l-0 first:pl-0"
              style={{ borderColor: "var(--ev-card-border-light)" }}
            >
              <span
                className="font-mono text-[15px] font-bold leading-none"
                style={{ color: kpi.color ?? "var(--ev-body)" }}
              >
                {kpi.value}
              </span>
              <span
                className="text-[10px] font-medium uppercase tracking-[.06em]"
                style={{ color: "var(--ev-text-tertiary)" }}
              >
                {kpi.label}
              </span>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("ouvrir-palette"))}
        className="relative hidden items-center md:flex hover:cursor-pointer"
        title="Rechercher (Ctrl K)"
      >
        <span
          className="w-[230px] rounded-lg border px-2.5 py-1.5 text-left text-[12.5px]"
          style={{
            borderColor: "var(--ev-input-border)",
            background: "var(--ev-input-bg)",
            color: "var(--ev-body-placeholder)",
          }}
        >
          Rechercher clients, numéros, MAC…
        </span>
        <span
          className="absolute right-2 rounded-[5px] border bg-white px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ borderColor: "var(--ev-input-border)", color: "var(--ev-text-tertiary)" }}
        >
          Ctrl K
        </span>
      </button>
    </div>
  );
}
