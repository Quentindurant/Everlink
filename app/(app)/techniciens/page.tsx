import {
  fetchAdvOverview,
  fetchTechniciens,
  fetchTechniciensDisponibles,
  listPrestataires,
} from "@/lib/repositories/technicienRepository";
import { PageHero } from "@/components/PageHero";
import { AdvTabs } from "./AdvTabs";

export const dynamic = "force-dynamic";

export default async function ADVPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? new Date().toISOString().slice(0, 10);
  const departement = params.dep ?? "";

  const [overview, techniciens, prestataires, disponibles] = await Promise.all([
    fetchAdvOverview(),
    fetchTechniciens(),
    listPrestataires(),
    fetchTechniciensDisponibles(new Date(dateStr), departement || undefined),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="ADV"
        title="Pilotage<br />des dossiers"
        kpis={[
          { value: overview.affectes.length, label: "affectés" },
          { value: disponibles.length, label: "techs libres ce jour", color: "var(--ev-green)" },
          { value: overview.liens.commande, label: "liens commandés", color: "var(--ev-amber)" },
        ]}
      />
      <AdvTabs
        overview={overview}
        techniciens={techniciens}
        prestataires={prestataires}
        disponibles={disponibles}
        dateStr={dateStr}
        departement={departement}
      />
    </main>
  );
}
