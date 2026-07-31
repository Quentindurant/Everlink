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
  return (
    <div
      className="flex flex-wrap items-end gap-6 rounded-3xl px-7 py-6"
      style={{
        background: "var(--ev-navy)",
        boxShadow: "0 20px 44px -30px rgba(11,18,32,.75)",
      }}
    >
      <div className="min-w-[250px] flex-1">
        <div
          className="font-mono text-[10px] font-medium tracking-[.16em] uppercase"
          style={{ color: accentColor }}
        >
          {label}
        </div>
        <h1
          className="mt-2 text-[40px] font-[800] leading-none tracking-tight uppercase"
          style={{ color: "var(--ev-text-primary)" }}
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {description && (
          <p
            className="mt-3 max-w-[44ch] text-sm"
            style={{ color: "var(--ev-text-secondary)", textWrap: "pretty" } as React.CSSProperties}
          >
            {description}
          </p>
        )}
      </div>
      {kpis.length > 0 && (
        <div className="flex flex-wrap">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className="border-l px-5.5 pt-0.5"
              style={{ borderColor: "var(--ev-navy-border)" }}
            >
              <div
                className="font-mono text-[38px] font-bold leading-none"
                style={{ color: kpi.color ?? "var(--ev-text-primary)" }}
              >
                {kpi.value}
              </div>
              <div
                className="mt-1.5 text-[10px] font-medium tracking-[.12em] uppercase"
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
