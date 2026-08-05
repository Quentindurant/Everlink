import { Send } from "lucide-react";
import { fetchAExpedier, listClientsPourStock, statsStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ExpeditionStaging } from "../ExpeditionStaging";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";

export const dynamic = "force-dynamic";

export default async function ExpeditionPage() {
  const [stats, aExpedier, clients] = await Promise.all([
    statsStock(),
    fetchAExpedier(),
    listClientsPourStock(),
  ]);
  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-amber)"
        label="Staging"
        title="Expédition"
        kpis={[
          { value: aExpedier.length, label: "prêts à partir" },
          { value: compte("ENVOYE"), label: "envoyés", color: "var(--ev-amber)" },
        ]}
      />

      <RetourStaging />

      <SectionStaging
        couleur="var(--ev-amber)"
        icone={<Send className="size-4" />}
        titre="Nouvelle expédition"
        compteur={aExpedier.length}
      >
        <ExpeditionStaging articles={aExpedier} clients={clients} types={stats.types} />
      </SectionStaging>
    </main>
  );
}
