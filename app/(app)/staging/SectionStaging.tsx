// Grande section visuelle du staging, façon HighStock : bordure teintée à la couleur de la
// fonction, icône dans une pastille colorée, titre gros et coloré. Identifiable d'un coup
// d'œil, sans texte d'explication.
export function SectionStaging({
  couleur,
  icone,
  titre,
  compteur,
  droite,
  children,
}: {
  couleur: string; // couleur d'accent (var(--ev-*) ou hex)
  icone: React.ReactNode;
  titre: string;
  compteur?: number;
  droite?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border-2 bg-white"
      style={{ borderColor: `color-mix(in oklab, ${couleur} 35%, white)` }}
    >
      <div
        className="flex items-center gap-2.5 border-b px-4 py-3"
        style={{
          borderColor: `color-mix(in oklab, ${couleur} 18%, white)`,
          background: `color-mix(in oklab, ${couleur} 5%, white)`,
        }}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: `color-mix(in oklab, ${couleur} 14%, white)`,
            color: `color-mix(in oklab, ${couleur} 75%, black)`,
          }}
        >
          {icone}
        </span>
        <span
          className="text-[15px] font-bold tracking-tight"
          style={{ color: `color-mix(in oklab, ${couleur} 70%, black)` }}
        >
          {titre}
        </span>
        {compteur !== undefined && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-bold"
            style={{
              background: `color-mix(in oklab, ${couleur} 14%, white)`,
              color: `color-mix(in oklab, ${couleur} 75%, black)`,
            }}
          >
            {compteur}
          </span>
        )}
        {droite && <div className="ml-auto">{droite}</div>}
      </div>
      {children}
    </section>
  );
}
