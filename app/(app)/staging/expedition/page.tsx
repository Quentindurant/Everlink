import { Send } from "lucide-react";
import {
  fetchPreparationStaging,
  listClientsPourStock,
  statsStock,
} from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ExpeditionStaging } from "../ExpeditionStaging";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";

export const dynamic = "force-dynamic";

export default async function ExpeditionPage() {
  const [stats, preparation, clients] = await Promise.all([
    statsStock(),
    fetchPreparationStaging(),
    listClientsPourStock(),
  ]);
  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;
  const nbArticles =
    preparation.dossiers.reduce((n, d) => n + d.articles.length, 0) + preparation.nonRattaches.length;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-amber)"
        label="Staging"
        title="Expédition"
        kpis={[
          { value: preparation.dossiers.length, label: "dossiers clients" },
          { value: nbArticles, label: "articles prêts" },
          { value: compte("ENVOYE"), label: "envoyés", color: "var(--ev-amber)" },
        ]}
      />

      <RetourStaging />

      <SectionStaging
        couleur="var(--ev-amber)"
        icone={<Send className="size-4" />}
        titre="Expédition par dossier client"
        compteur={preparation.dossiers.length}
      >
        <ExpeditionStaging preparation={preparation} clients={clients} />
      </SectionStaging>
    </main>
  );
}
