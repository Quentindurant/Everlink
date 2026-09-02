import {
  fetchLotOuvert,
  fetchLotsPartis,
  fetchOntsAnnonces,
} from "@/lib/repositories/ontRepository";
import { listClientsPourStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { OntStaging } from "./OntStaging";

export const dynamic = "force-dynamic";

export default async function OntPage() {
  const [annonces, lotOuvert, lotsPartis, clients] = await Promise.all([
    fetchOntsAnnonces(),
    fetchLotOuvert(),
    fetchLotsPartis(),
    listClientsPourStock(),
  ]);

  const enAttente = annonces.filter((o) => !o.dateReception).length;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-purple)"
        label="Staging"
        title="ONT récupérés"
        kpis={[
          { value: enAttente, label: "annoncés, pas arrivés" },
          { value: lotOuvert?.articles.length ?? 0, label: "dans le lot", color: "var(--ev-amber)" },
          { value: lotsPartis.length, label: "lots partis", color: "var(--ev-green)" },
        ]}
      />
      <OntStaging
        annonces={annonces}
        lotOuvert={lotOuvert}
        lotsPartis={lotsPartis}
        clients={clients}
      />
    </main>
  );
}
