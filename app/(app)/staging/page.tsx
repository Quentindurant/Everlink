import Link from "next/link";
import { PackagePlus, ScrollText, Send } from "lucide-react";
import { fetchAExpedier, fetchHistoriqueColis, statsStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";

export const dynamic = "force-dynamic";

// Grande tuile d'étape, façon portail HighStock : couleur de la fonction, grosse icône,
// titre gros, compteur. Une tuile = une page.
function Tuile({
  href,
  couleur,
  icone,
  titre,
  compteur,
  libelleCompteur,
}: {
  href: string;
  couleur: string;
  icone: React.ReactNode;
  titre: string;
  compteur: number;
  libelleCompteur: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border-2 bg-white p-6 transition-transform hover:-translate-y-0.5"
      style={{ borderColor: `color-mix(in oklab, ${couleur} 35%, white)` }}
    >
      <span
        className="grid size-12 place-items-center rounded-xl"
        style={{
          background: `color-mix(in oklab, ${couleur} 14%, white)`,
          color: `color-mix(in oklab, ${couleur} 75%, black)`,
        }}
      >
        {icone}
      </span>
      <span
        className="text-lg font-bold tracking-tight"
        style={{ color: `color-mix(in oklab, ${couleur} 70%, black)` }}
      >
        {titre}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="font-mono text-[26px] font-bold leading-none"
          style={{ color: `color-mix(in oklab, ${couleur} 75%, black)` }}
        >
          {compteur}
        </span>
        <span className="text-xs" style={{ color: "var(--ev-body-muted)" }}>
          {libelleCompteur}
        </span>
      </span>
    </Link>
  );
}

export default async function StagingPage() {
  const [stats, aExpedier, historique] = await Promise.all([
    statsStock(),
    fetchAExpedier(),
    fetchHistoriqueColis(),
  ]);

  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;
  const enCours = historique.filter((c) => c.suiviStatut === "EN_COURS").length;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="Staging"
        title="Stock & routeurs"
        kpis={[
          { value: compte("EN_STOCK"), label: "en stock" },
          { value: compte("CONFIGURE"), label: "configurés", color: "var(--ev-blue)" },
          { value: compte("ENVOYE"), label: "envoyés", color: "var(--ev-amber)" },
          { value: compte("INSTALLE"), label: "installés", color: "var(--ev-green)" },
        ]}
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Tuile
          href="/staging/reception"
          couleur="var(--ev-blue)"
          icone={<PackagePlus className="size-6" />}
          titre="Réception"
          compteur={compte("EN_STOCK") + compte("CONFIGURE")}
          libelleCompteur="en stock"
        />
        <Tuile
          href="/staging/expedition"
          couleur="var(--ev-amber)"
          icone={<Send className="size-6" />}
          titre="Expédition"
          compteur={aExpedier.length}
          libelleCompteur="prêts à partir"
        />
        <Tuile
          href="/staging/suivi"
          couleur="var(--ev-green)"
          icone={<ScrollText className="size-6" />}
          titre="Suivi"
          compteur={enCours}
          libelleCompteur="colis en cours"
        />
      </div>
    </main>
  );
}
