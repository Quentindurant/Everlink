import { fetchLots } from "@/lib/repositories/lotsRepository";
import { LotsTable } from "./LotsTable";
import { PageHero } from "@/components/PageHero";

export const dynamic = "force-dynamic";

export default async function LotsPage() {
  const lots = await fetchLots();
  const nbActifs = lots.filter((l) => l.actif).length;
  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-green)"
        label="Lots"
        title="Vagues de<br />bascule"
        description="Un lot = les clients qui basculent la même nuit, et la référence portée par les exports."
        kpis={[
          { value: nbActifs, label: "lot actif" },
          { value: "0%", label: "avancement", color: "var(--ev-text-secondary)" },
        ]}
      />
      <LotsTable lots={lots} />
    </main>
  );
}
