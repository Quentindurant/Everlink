import {
  fetchAExpedier,
  fetchAInstaller,
  fetchHistoriqueColis,
  listClientsPourStock,
  statsStock,
} from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ImportStock } from "./ImportStock";
import { AInstaller } from "./AInstaller";
import { ExpeditionStaging } from "./ExpeditionStaging";
import { RetourForm } from "./RetourForm";
import { HistoriqueColis } from "./HistoriqueColis";

export const dynamic = "force-dynamic";

export default async function StagingPage() {
  const [stats, aExpedier, historique, aInstaller, clients] = await Promise.all([
    statsStock(),
    fetchAExpedier(),
    fetchHistoriqueColis(),
    fetchAInstaller(),
    listClientsPourStock(),
  ]);

  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-3.5 p-5 pb-15">
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

      <ImportStock />

      <AInstaller lignes={aInstaller} />

      <ExpeditionStaging articles={aExpedier} clients={clients} types={stats.types} />

      <RetourForm />

      <HistoriqueColis colis={historique} />
    </main>
  );
}
