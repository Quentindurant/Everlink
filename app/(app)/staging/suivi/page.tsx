import { CalendarClock, ScrollText } from "lucide-react";
import { fetchAInstaller, fetchHistoriqueColis } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { AInstaller } from "../AInstaller";
import { HistoriqueColis } from "../HistoriqueColis";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";

export const dynamic = "force-dynamic";

export default async function SuiviPage() {
  const [aInstaller, historique] = await Promise.all([
    fetchAInstaller(),
    fetchHistoriqueColis(),
  ]);
  const enCours = historique.filter((c) => c.suiviStatut === "EN_COURS").length;
  const livres = historique.filter((c) => c.suiviStatut === "LIVRE").length;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-green)"
        label="Staging"
        title="Suivi"
        kpis={[
          { value: enCours, label: "colis en cours", color: "var(--ev-blue)" },
          { value: livres, label: "livrés", color: "var(--ev-green)" },
          { value: aInstaller.length, label: "à installer", color: "var(--ev-cyan)" },
        ]}
      />

      <RetourStaging />

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
        couleur="var(--ev-green)"
        icone={<ScrollText className="size-4" />}
        titre="Historique des expéditions"
        compteur={historique.length}
      >
        <HistoriqueColis colis={historique} />
      </SectionStaging>
    </main>
  );
}
