import Link from "next/link";
import { fetchAccueil } from "@/lib/repositories/accueilRepository";
import { PageHero } from "@/components/PageHero";
import { StatutBadge, type PalNom } from "@/components/StatutBadge";

export const dynamic = "force-dynamic";

// Teintes des statuts de lien (maquette, famille "Commande de lien").
const PAL_LIEN: Record<string, PalNom> = {
  "Non commandé": "gray",
  Commandé: "amber",
  Livré: "green",
};

// Grande carte KPI cliquable (maquette accueil: chiffre 30px Space Mono coloré).
function KpiCarte({
  valeur,
  label,
  couleur,
  href,
}: {
  valeur: number;
  label: string;
  couleur: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[10px] border border-[color:var(--ev-card-border)] bg-white px-[18px] py-4 transition-colors hover:border-[color:var(--ev-card-border-hover)]"
    >
      <div
        className="font-mono text-[30px] font-bold leading-none"
        style={{ color: couleur }}
      >
        {valeur}
      </div>
      <div className="mt-1.5 text-[12.5px]" style={{ color: "var(--ev-body-muted)" }}>
        {label}
      </div>
    </Link>
  );
}

// Raccourci compact (maquette: chiffre 17px Space Mono bleu + label inline).
function Raccourci({ valeur, label, href }: { valeur: number; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[10px] border border-[color:var(--ev-card-border)] bg-white px-3.5 py-2.5 transition-colors hover:border-[color:var(--ev-card-border-hover)]"
    >
      <span
        className="font-mono text-[17px] font-bold"
        style={{ color: "var(--ev-accent-text)" }}
      >
        {valeur}
      </span>
      <span className="text-xs" style={{ color: "var(--ev-body-secondary)" }}>
        {label}
      </span>
    </Link>
  );
}

function CarteListe({
  titre,
  count,
  vide,
  children,
}: {
  titre: string;
  count: number;
  vide: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-[10px] border bg-white"
      style={{ borderColor: "var(--ev-card-border)" }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3 text-[13px] font-bold"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        {titre}
        <span className="font-mono text-[11.5px] font-bold" style={{ color: "var(--ev-text-tertiary)" }}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="px-4 py-3.5 text-[12.5px]" style={{ color: "var(--ev-body-muted)" }}>
          {vide}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

const TH = "px-3 py-[7px] text-left text-[10.5px] font-semibold uppercase tracking-[.07em]";

export default async function AccueilPage() {
  const data = await fetchAccueil();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col gap-3.5 p-5 pb-15">
      <PageHero accentColor="var(--ev-blue)" label="Aujourd'hui" title="Vue du jour" />

      {/* 3 grands KPI cliquables */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <KpiCarte
          valeur={data.interventions.length}
          label="interventions à venir"
          couleur="var(--ev-accent-text)"
          href="/techniciens"
        />
        <KpiCarte
          valeur={data.bloques.length}
          label="dossiers bloqués"
          couleur={data.bloques.length ? "var(--pal-red-fg)" : "var(--ev-text-tertiary)"}
          href="/techniciens"
        />
        <KpiCarte
          valeur={data.aRelancer.length}
          label="clients à relancer"
          couleur={data.aRelancer.length ? "var(--pal-amber-fg)" : "var(--ev-text-tertiary)"}
          href="/techniciens"
        />
      </div>

      {/* Raccourcis */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Raccourci valeur={data.liensACommander} label="liens à commander" href="/techniciens" />
        <Raccourci valeur={data.stock.enStock} label="routeurs en stock" href="/staging" />
        <Raccourci valeur={data.stock.aEnvoyer} label="à configurer / envoyer" href="/staging" />
        <Raccourci valeur={data.stock.aInstaller} label="à installer" href="/staging" />
      </div>

      {/* Interventions + colonne alertes */}
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div
          className="overflow-hidden rounded-[10px] border bg-white"
          style={{ borderColor: "var(--ev-card-border)" }}
        >
          <div
            className="border-b px-4 py-3 text-[13px] font-bold"
            style={{ borderColor: "var(--ev-card-border-light)" }}
          >
            Interventions à venir
          </div>
          {data.interventions.length === 0 ? (
            <p className="px-4 py-3.5 text-[12.5px]" style={{ color: "var(--ev-body-muted)" }}>
              Aucune intervention planifiée. Planifiez-les depuis l&apos;espace ADV.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Date", "Client", "Étape", "Lien", "Technicien"].map((h) => (
                      <th key={h} className={TH} style={{ color: "var(--ev-th)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.interventions.map((i) => {
                    const cestAujourdhui = i.dateIso === aujourdhui;
                    return (
                      <tr
                        key={i.clientId}
                        className="border-t transition-colors hover:bg-[var(--ev-row-hover)]"
                        style={{ borderColor: "var(--ev-row-border)" }}
                      >
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-[12.5px] tabular-nums ${cestAujourdhui ? "font-bold" : ""}`}
                          style={cestAujourdhui ? { color: "var(--ev-accent-text)" } : undefined}
                        >
                          {cestAujourdhui
                            ? "aujourd'hui"
                            : new Date(i.dateIso).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2 text-[12.5px]">
                          <Link
                            href={`/clients/${i.clientId}`}
                            className="hover:underline"
                            style={{ color: "var(--ev-blue)" }}
                          >
                            {i.raisonSociale}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {i.etape ? (
                            <StatutBadge label={i.etape} couleur={i.etapeCouleur ?? undefined} />
                          ) : (
                            <span className="text-xs" style={{ color: "var(--ev-body-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {i.lienStatut ? (
                            <StatutBadge label={i.lienStatut} pal={PAL_LIEN[i.lienStatut] ?? "gray"} />
                          ) : (
                            <span className="text-xs" style={{ color: "var(--ev-body-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[12.5px]">{i.technicienNom ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <CarteListe titre="Dossiers bloqués" count={data.bloques.length} vide="Aucun dossier bloqué. 👌">
            <ul className="flex flex-col py-1">
              {data.bloques.map((b) => (
                <li
                  key={b.clientId}
                  className="flex items-center justify-between gap-2 px-4 py-1.5 transition-colors hover:bg-[var(--ev-row-hover)]"
                >
                  <Link
                    href={`/clients/${b.clientId}`}
                    className="truncate text-[12.5px] font-medium hover:underline"
                    style={{ color: "var(--ev-blue)" }}
                  >
                    {b.raisonSociale}
                  </Link>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--ev-body-muted)" }}>
                    {b.etape}
                  </span>
                </li>
              ))}
            </ul>
          </CarteListe>

          <CarteListe
            titre="À relancer (3+ tentatives)"
            count={data.aRelancer.length}
            vide="Personne à relancer."
          >
            <ul className="flex flex-col py-1">
              {data.aRelancer.map((r) => (
                <li
                  key={r.clientId}
                  className="flex items-center justify-between gap-2 px-4 py-1.5 transition-colors hover:bg-[var(--ev-row-hover)]"
                >
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="truncate text-[12.5px] font-medium hover:underline"
                    style={{ color: "var(--ev-blue)" }}
                  >
                    {r.raisonSociale}
                  </Link>
                  <StatutBadge label={`${r.tentatives} tent.`} pal="amber" />
                </li>
              ))}
            </ul>
          </CarteListe>
        </div>
      </div>
    </main>
  );
}
