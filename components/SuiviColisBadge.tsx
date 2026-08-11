import {
  LIBELLE_SUIVI,
  PAL_SUIVI,
  transporteurAvecSuiviApi,
  urlSuiviTransporteur,
  type SuiviStatut,
} from "@/lib/domain/tracking/laposte";

// Pastille d'état d'un colis (En cours / Livré / Inconnu), teintes du design system.
// Le libellé La Poste brut ("Pris en charge…", "Votre colis est livré") est en title/tooltip.
// Transporteur sans API (DHL…) : pastille « Suivi manuel », numéro cliquable vers leur site.
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
  const suiviApi = transporteurAvecSuiviApi(transporteur);
  const urlExterne = urlSuiviTransporteur(transporteur, numeroSuivi);
  const s = (statut as SuiviStatut) || "INCONNU";
  const pal = suiviApi ? (PAL_SUIVI[s] ?? "gray") : "blue";
  const texteBadge = suiviApi ? (LIBELLE_SUIVI[s] ?? "Suivi") : "Suivi manuel";

  const numero = (
    <span className="font-mono text-[10.5px]" style={{ color: "var(--ev-text-tertiary)" }}>
      {transporteur ? `${transporteur} · ` : ""}
      {numeroSuivi}
    </span>
  );

  return (
    <span
      className="inline-flex flex-col gap-0.5"
      title={suiviApi ? (libelle ?? undefined) : "Pas de suivi automatique pour ce transporteur"}
    >
      <span
        className="ev-badge w-fit"
        style={{ background: `var(--pal-${pal}-bg)`, color: `var(--pal-${pal}-fg)` }}
      >
        <span className="ev-badge-dot" style={{ background: `var(--pal-${pal}-dot)` }} />
        {texteBadge}
      </span>
      {urlExterne ? (
        <a
          href={urlExterne}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
          title={`Suivre sur le site ${transporteur}`}
        >
          {numero}
        </a>
      ) : (
        numero
      )}
    </span>
  );
}
