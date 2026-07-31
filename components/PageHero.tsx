type Kpi = {
  value: string | number;
  label: string;
  color?: string;
};

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
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl px-6 py-4"
      style={{
        background: "var(--ev-navy)",
        boxShadow: "0 16px 34px -28px rgba(11,18,32,.75)",
      }}
    >
      <div className="flex min-w-[200px] flex-1 items-baseline gap-3">
        <h1
          className="text-[22px] font-[800] leading-none tracking-tight uppercase"
          style={{ color: "var(--ev-text-primary)" }}
        >
          {titrePlat}
        </h1>
        <span
          className="font-mono text-[10px] font-medium tracking-[.16em] uppercase"
          style={{ color: accentColor }}
        >
          {label}
        </span>
      </div>
      {kpis.length > 0 && (
        <div className="flex flex-wrap">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className="border-l px-5 pt-0.5"
              style={{ borderColor: "var(--ev-navy-border)" }}
            >
              <div
                className="font-mono text-[26px] font-bold leading-none"
                style={{ color: kpi.color ?? "var(--ev-text-primary)" }}
              >
                {kpi.value}
              </div>
              <div
                className="mt-1 text-[9px] font-medium tracking-[.12em] uppercase"
                style={{ color: "var(--ev-text-tertiary)" }}
              >
                {kpi.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
