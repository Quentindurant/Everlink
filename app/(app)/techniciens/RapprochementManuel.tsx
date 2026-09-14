"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Plus, RefreshCw } from "lucide-react";
import {
  creerDossierDepuisLigneAction,
  fetchRapprochementManquant,
  lierDossierAuTableauAction,
  type RapprochementManquant,
} from "./zohoViewActions";

// Ce que la synchronisation ne peut pas relier toute seule. Deux noms qu'aucune règle ne doit
// assimiler — « STEPHENSON - BOULOGNE » d'un côté, « - ODESEINE » de l'autre — laissaient un
// dossier figé sur un statut périmé, visible de personne : le seul signal était une infobulle
// après une synchronisation lancée à la main.
//
// Le lien posé ici est mémorisé sur le dossier et prime sur toute comparaison de noms lors des
// synchronisations suivantes. Une fois tranché, c'est tranché.
export function RapprochementManuel() {
  const [donnees, setDonnees] = useState<RapprochementManquant | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const charger = () => {
    startTransition(async () => {
      setDonnees(await fetchRapprochementManquant());
    });
  };

  useEffect(charger, []);

  if (!donnees?.configure) return null;
  const { lignes, dossiers } = donnees;
  if (lignes.length === 0 && dossiers.length === 0) return null;

  const agir = (action: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await action();
      if (!r.success) {
        setErreur(r.error ?? "Échec.");
        return;
      }
      setErreur(null);
      setDonnees(await fetchRapprochementManquant());
    });
  };

  const lier = (nomSheet: string) => {
    const clientId = choix[nomSheet];
    if (!clientId) return;
    agir(() => lierDossierAuTableauAction(clientId, nomSheet));
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ borderColor: "var(--pal-amber-dot)", background: "var(--pal-amber-bg)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-bold" style={{ color: "var(--pal-amber-fg)" }}>
          À rapprocher — {lignes.length} ligne(s) du tableau, {dossiers.length} dossier(s) sans
          ligne
        </span>
        <button
          type="button"
          onClick={charger}
          disabled={enCours}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50"
        >
          <RefreshCw className={enCours ? "size-3 animate-spin" : "size-3"} />
          Actualiser
        </button>
      </div>

      <p className="text-[12px]" style={{ color: "var(--pal-amber-fg)" }}>
        Ces lignes portent un nom que l&apos;app ne peut pas relier seule. Tant qu&apos;elles ne
        sont pas liées, le statut, la date et le technicien du dossier restent figés.{" "}
        <strong>Lier</strong> rattache la ligne à un dossier existant ;{" "}
        <strong>Créer</strong> ouvre un dossier propre à cette ligne — c&apos;est ce qu&apos;il
        faut pour deux agences d&apos;un même cabinet, qui migrent ensemble mais se suivent
        séparément.
      </p>

      {erreur && (
        <p
          className="rounded-md bg-white px-2.5 py-1.5 text-[12px]"
          style={{ color: "var(--pal-red-fg)" }}
        >
          {erreur}
        </p>
      )}

      {lignes.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--pal-amber-fg)" }}>
          Aucune ligne orpheline. Les dossiers restants n&apos;apparaissent pas dans le tableau de
          ce mois.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {lignes.map((l) => (
            <li
              key={l.nomSheet}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={l.nomSheet}>
                {l.nomSheet}
              </span>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">
                {[l.dpt && `dpt ${l.dpt}`, l.statut, l.date, l.tech].filter(Boolean).join(" · ") ||
                  "—"}
              </span>
              <select
                value={choix[l.nomSheet] ?? ""}
                onChange={(e) => setChoix((c) => ({ ...c, [l.nomSheet]: e.target.value }))}
                className="h-7 w-64 rounded-md border border-input bg-transparent px-1.5 text-[12px] outline-none focus:border-ring"
              >
                <option value="">Lier au dossier…</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.raisonSociale}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={enCours || !choix[l.nomSheet]}
                onClick={() => lier(l.nomSheet)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-semibold hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
              >
                <Link2 className="size-3" />
                Lier
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={() => agir(() => creerDossierDepuisLigneAction(l.nomSheet))}
                title="Ouvrir un dossier propre à cette ligne, déjà rattaché au tableau"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-semibold hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
              >
                <Plus className="size-3" />
                Créer
              </button>
            </li>
          ))}
        </ul>
      )}

      {dossiers.length > 0 && (
        <p className="text-[11.5px]" style={{ color: "var(--pal-amber-fg)" }}>
          Sans ligne : {dossiers.map((d) => d.raisonSociale).join(" · ")}
        </p>
      )}
    </section>
  );
}
