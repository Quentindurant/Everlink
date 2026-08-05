import { CalendarClock, PackagePlus, ScrollText, Send, Undo2 } from "lucide-react";
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
import { SectionStaging } from "./SectionStaging";

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

      <SectionStaging
        couleur="var(--ev-blue)"
        icone={<PackagePlus className="size-4" />}
        titre="Réception matériel"
      >
        <ImportStock />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-amber)"
        icone={<Send className="size-4" />}
        titre="Expédition de matériel"
        compteur={aExpedier.length}
      >
        <ExpeditionStaging articles={aExpedier} clients={clients} types={stats.types} />
      </SectionStaging>

      {aInstaller.length > 0 && (
        <SectionStaging
          couleur="var(--ev-cyan)"
          icone={<CalendarClock className="size-4" />}
          titre="À installer"
          compteur={aInstaller.length}
        >
          <AInstaller lignes={aInstaller} />
        </SectionStaging>
      )}

      <SectionStaging
        couleur="var(--ev-purple)"
        icone={<Undo2 className="size-4" />}
        titre="Retour routeur client"
      >
        <RetourForm />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-slate)"
        icone={<ScrollText className="size-4" />}
        titre="Historique des expéditions"
        compteur={historique.length}
      >
        <HistoriqueColis colis={historique} />
      </SectionStaging>
    </main>
  );
}
