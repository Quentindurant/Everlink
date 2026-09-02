import { Package, Truck, Warehouse, MapPin } from "lucide-react";
import {
  LIBELLES_ETAPE_COLIS,
  transporteurAvecSuiviApi,
  urlSuiviTransporteur,
  type EtapeColis,
} from "@/lib/domain/tracking/laposte";

const ICONES: Record<EtapeColis, React.ComponentType<{ className?: string }>> = {
  1: Package,
  2: Warehouse,
  3: Truck,
  4: MapPin,
};

const ETAPES: EtapeColis[] = [1, 2, 3, 4];

// Teinte des points et des traits non franchis : assez pâle pour se distinguer du parcours
// accompli, assez visible pour que la suite du trajet reste lisible.
const ATTENTE = "var(--ev-card-border)";

// Frise horizontale d'avancement d'un colis. Les points franchis sont pleins, les suivants
// pâles. Sous 640 px elle bascule en vertical : quatre libellés côte à côte ne tiennent pas
// sur un téléphone.
//
// Le composant ne devine rien : `etape` lui est fournie, et les deux cas dégradés (suivi
// introuvable, transporteur sans API) s'affichent au lieu d'être maquillés en progression.
export function FriseColis({
  etape,
  libelle,
  livreLe,
  transporteur,
  numeroSuivi,
  compact = false,
}: {
  etape: number | null;
  libelle: string | null;
  livreLe: string | null;
  transporteur: string | null;
  numeroSuivi: string | null;
  /** Version d'une seule ligne, pour les listes où la frise complète se répète. */
  compact?: boolean;
}) {
  if (!numeroSuivi) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const suiviApi = transporteurAvecSuiviApi(transporteur);
  const urlExterne = urlSuiviTransporteur(transporteur, numeroSuivi);
  // Sans relevé automatique, on n'affirme rien au-delà de « parti ».
  const atteinte = (suiviApi ? Math.min(Math.max(etape ?? 1, 1), 4) : 1) as EtapeColis;

  if (compact) {
    return (
      <FriseCompacte
        atteinte={atteinte}
        libelle={libelle}
        livreLe={livreLe}
        suiviApi={suiviApi}
        transporteur={transporteur}
        numeroSuivi={numeroSuivi}
        urlExterne={urlExterne}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0">
        {ETAPES.map((e) => {
          const Icone = ICONES[e];
          const franchie = e <= atteinte;
          const courante = e === atteinte;
          const incertaine = !suiviApi && e > 1;
          return (
            // items-start sert la pile mobile ; au-delà, il faut rendre la largeur au libellé
            // pour qu'il se centre sous son point au lieu de se coller à gauche.
            <li
              key={e}
              className="flex items-start gap-3 sm:flex-1 sm:flex-col sm:items-stretch sm:gap-1.5"
            >
              <div className="flex items-center sm:w-full">
                {/* Trait gauche : absent sur le premier point. */}
                <span
                  aria-hidden
                  className="hidden h-1 flex-1 rounded-full sm:block"
                  style={{ background: e === 1 ? "transparent" : trait(franchie) }}
                />
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full transition-colors motion-reduce:transition-none"
                  style={{
                    background: franchie ? "var(--pal-green-bg)" : "var(--ev-surface)",
                    color: franchie ? "var(--pal-green-fg)" : "var(--ev-text-tertiary)",
                    border: franchie ? "none" : `1px solid ${ATTENTE}`,
                    outline: courante ? "2px solid var(--pal-green-dot)" : "none",
                    outlineOffset: 2,
                  }}
                  title={courante ? (libelle ?? LIBELLES_ETAPE_COLIS[e]) : LIBELLES_ETAPE_COLIS[e]}
                >
                  <Icone className="size-4" />
                </span>
                <span
                  aria-hidden
                  className="hidden h-1 flex-1 rounded-full sm:block"
                  style={{
                    background: e === 4 ? "transparent" : trait(e < atteinte),
                    ...(incertaine ? { opacity: 0.4 } : null),
                  }}
                />
              </div>
              <span
                className="text-[11px] sm:text-center"
                style={{
                  color: franchie ? "var(--ev-body)" : "var(--ev-text-tertiary)",
                  fontWeight: courante ? 700 : 500,
                }}
              >
                {LIBELLES_ETAPE_COLIS[e]}
                {e === 4 && livreLe ? (
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {new Date(livreLe).toLocaleDateString("fr-FR")}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
        <span className="font-mono" style={{ color: "var(--ev-text-tertiary)" }}>
          {transporteur ? `${transporteur} · ` : ""}
          {numeroSuivi}
        </span>
        {urlExterne ? (
          <a
            href={urlExterne}
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: "var(--ev-text-tertiary)" }}
          >
            Suivre sur le site {transporteur}
          </a>
        ) : null}
        {!suiviApi ? (
          <span style={{ color: "var(--ev-text-tertiary)" }}>
            Pas de suivi automatique pour ce transporteur
          </span>
        ) : null}
        {suiviApi && etape === null ? (
          <span style={{ color: "var(--ev-text-tertiary)" }}>Suivi pas encore relevé</span>
        ) : null}
      </div>
    </div>
  );
}

// Une seule ligne : quatre pastilles, l'étape atteinte en toutes lettres, puis le colis.
// Dans une liste de vingt envois, la frise complète répétée noie l'information au lieu de la
// donner — et « pas de suivi automatique » vingt fois de suite est du bruit, pas un message.
function FriseCompacte({
  atteinte,
  libelle,
  livreLe,
  suiviApi,
  transporteur,
  numeroSuivi,
  urlExterne,
}: {
  atteinte: EtapeColis;
  libelle: string | null;
  livreLe: string | null;
  suiviApi: boolean;
  transporteur: string | null;
  numeroSuivi: string;
  urlExterne: string | null;
}) {
  const livre = atteinte === 4;
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
      <span className="flex items-center gap-1" title={libelle ?? undefined}>
        {ETAPES.map((e) => (
          <span
            key={e}
            aria-hidden
            className="rounded-full"
            style={{
              width: e === atteinte ? 9 : 6,
              height: e === atteinte ? 9 : 6,
              background: e <= atteinte ? "var(--pal-green-dot)" : ATTENTE,
            }}
          />
        ))}
      </span>

      <span
        className="font-semibold"
        style={{ color: livre ? "var(--pal-green-fg)" : "var(--ev-body)" }}
      >
        {LIBELLES_ETAPE_COLIS[atteinte]}
        {livre && livreLe ? ` le ${new Date(livreLe).toLocaleDateString("fr-FR")}` : ""}
      </span>

      <span className="font-mono" style={{ color: "var(--ev-text-tertiary)" }}>
        {transporteur ? `${transporteur} · ` : ""}
        {urlExterne ? (
          <a href={urlExterne} target="_blank" rel="noreferrer" className="underline">
            {numeroSuivi}
          </a>
        ) : (
          numeroSuivi
        )}
      </span>

      {!suiviApi ? (
        <span
          className="rounded px-1 py-px text-[10px] uppercase tracking-wide"
          style={{ background: "var(--ev-surface)", color: "var(--ev-text-tertiary)" }}
          title="Ce transporteur n'a pas de suivi automatique : l'état n'avance pas tout seul."
        >
          manuel
        </span>
      ) : null}
    </span>
  );
}

function trait(franchi: boolean): string {
  return franchi ? "var(--pal-green-dot)" : ATTENTE;
}
