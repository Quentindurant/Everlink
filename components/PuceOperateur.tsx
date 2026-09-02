import { estSim, operateurSim } from "@/lib/domain/staging/sim";

// Puce colorée d'opérateur, à côté du numéro d'une carte SIM. Rien ne ressemble plus à une
// SIM Orange qu'une SIM Bouygues : la couleur fait le tri avant même la lecture du numéro.
// Un numéro non reconnu n'affiche rien plutôt que d'annoncer le mauvais opérateur.
export function PuceOperateur({ type, numeroSerie }: { type: string; numeroSerie: string }) {
  if (!estSim(type)) return null;
  const op = operateurSim(numeroSerie);
  if (!op) return null;
  return (
    <span
      className="ev-badge shrink-0"
      style={{ background: `var(--pal-${op.pal}-bg)`, color: `var(--pal-${op.pal}-fg)` }}
      title={`Carte SIM ${op.nom}`}
    >
      <span className="ev-badge-dot" style={{ background: `var(--pal-${op.pal}-dot)` }} />
      {op.nom}
    </span>
  );
}
