import { fetchArticlesStock, statsStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ImportStock } from "./ImportStock";
import { StockTable } from "./StockTable";

export const dynamic = "force-dynamic";

export default async function StagingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filtreType = params.type ?? "";
  const filtreStatut = params.statut ?? "";

  const [stats, articles] = await Promise.all([
    statsStock(),
    fetchArticlesStock({ type: filtreType || undefined, statut: filtreStatut || undefined }),
  ]);

  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="Staging"
        title="Stock<br />& routeurs"
        description="Roulement du matériel : reçu → configuré → envoyé → installé. Le routeur récupéré chez le client est enregistré en retour."
        kpis={[
          { value: compte("EN_STOCK"), label: "en stock" },
          { value: compte("CONFIGURE"), label: "configurés", color: "var(--ev-blue)" },
          { value: compte("ENVOYE"), label: "envoyés", color: "var(--ev-amber)" },
          { value: compte("INSTALLE"), label: "installés", color: "var(--ev-green)" },
        ]}
      />

      <ImportStock />

      <StockTable
        articles={articles}
        types={stats.types}
        filtreType={filtreType}
        filtreStatut={filtreStatut}
      />
    </main>
  );
}
