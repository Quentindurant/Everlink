import Link from "next/link";
import { Phone } from "lucide-react";
import { CopiePuce } from "@/components/CopiePuce";
import type { EquipementSepareLigne } from "@/lib/repositories/syncRepository";

// Équipements déclarés à part côté UNYC (pieuvres de conférence, T42U…) : une sous-section
// par modèle, avec le client, la MAC et les numéros à copier. Le drapeau « à part » se coche
// dans Paramètres → Modèles d'équipement.
export function EquipementsSepares({ lignes }: { lignes: EquipementSepareLigne[] }) {
  if (lignes.length === 0) return null;

  const parModele = new Map<string, EquipementSepareLigne[]>();
  for (const l of lignes) {
    const liste = parModele.get(l.modeleLibelle);
    if (liste) liste.push(l);
    else parModele.set(l.modeleLibelle, [l]);
  }

  return (
    <section
      className="overflow-hidden rounded-xl border-2 bg-white"
      style={{ borderColor: "color-mix(in oklab, var(--ev-purple) 35%, white)" }}
    >
      <div
        className="flex items-center gap-2.5 border-b px-4 py-3"
        style={{
          borderColor: "color-mix(in oklab, var(--ev-purple) 18%, white)",
          background: "color-mix(in oklab, var(--ev-purple) 5%, white)",
        }}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: "color-mix(in oklab, var(--ev-purple) 14%, white)",
            color: "color-mix(in oklab, var(--ev-purple) 75%, black)",
          }}
        >
          <Phone className="size-4" />
        </span>
        <span
          className="text-[15px] font-bold tracking-tight"
          style={{ color: "color-mix(in oklab, var(--ev-purple) 70%, black)" }}
        >
          À déclarer à part — pieuvres &amp; postes spécifiques
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-bold"
          style={{
            background: "color-mix(in oklab, var(--ev-purple) 14%, white)",
            color: "color-mix(in oklab, var(--ev-purple) 75%, black)",
          }}
        >
          {lignes.length}
        </span>
      </div>

      {[...parModele.entries()].map(([modele, groupe]) => (
        <div key={modele}>
          <div
            className="border-t px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[color:var(--ev-accent-text)]"
            style={{ borderColor: "var(--ev-card-border-light)", background: "var(--ev-surface)" }}
          >
            {modele}
            <span className="ml-1.5 font-mono">{groupe.length}</span>
          </div>
          {groupe.map((l, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2"
              style={{ borderColor: "var(--ev-row-border)" }}
            >
              <Link
                href={`/clients/${l.clientId}`}
                className="w-64 truncate text-[13px] font-semibold hover:underline"
              >
                {l.clientRaisonSociale}
              </Link>
              <CopiePuce valeur={l.macBrut} titre="MAC" />
              {l.utilisateurNom && (
                <span className="text-[12px] text-muted-foreground">{l.utilisateurNom}</span>
              )}
              <span className="flex flex-wrap items-center gap-1.5">
                {l.numeros.map((n) => (
                  <CopiePuce key={n} valeur={n} titre="Numéro" />
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
