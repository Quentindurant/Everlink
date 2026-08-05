import { PackagePlus, Undo2 } from "lucide-react";
import { statsStock } from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ImportStock } from "../ImportStock";
import { RetourForm } from "../RetourForm";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";

export const dynamic = "force-dynamic";

export default async function ReceptionPage() {
  const stats = await statsStock();
  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Staging"
        title="Réception"
        kpis={[
          { value: compte("EN_STOCK"), label: "en stock" },
          { value: compte("RETOUR"), label: "retours", color: "var(--ev-purple)" },
        ]}
      />

      <RetourStaging />

      <SectionStaging
        couleur="var(--ev-blue)"
        icone={<PackagePlus className="size-4" />}
        titre="Importer le stock (.xlsx)"
      >
        <ImportStock />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-purple)"
        icone={<Undo2 className="size-4" />}
        titre="Retour routeur client"
      >
        <RetourForm />
      </SectionStaging>
    </main>
  );
}
