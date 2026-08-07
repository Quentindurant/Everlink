import { Router } from "lucide-react";
import { fetchConfigsRouteur, listClientsPourStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";
import { ConfigRouteurStaging } from "./ConfigRouteurStaging";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const [configs, clients] = await Promise.all([fetchConfigsRouteur(), listClientsPourStock()]);

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-purple)"
        label="Staging"
        title="Config routeur"
        kpis={[{ value: configs.length, label: "configurations" }]}
      />

      <RetourStaging />

      <SectionStaging
        couleur="var(--ev-purple)"
        icone={<Router className="size-4" />}
        titre="Configurations routeur Sewan (.rsc)"
        compteur={configs.length}
      >
        <ConfigRouteurStaging configs={configs} clients={clients} />
      </SectionStaging>
    </main>
  );
}
