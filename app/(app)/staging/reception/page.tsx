import { Boxes, PackagePlus, Undo2 } from "lucide-react";
import {
  fetchStockActif,
  listClientsPourStock,
  statsStock,
} from "@/lib/repositories/stockRepository";
import { PageHero } from "@/components/PageHero";
import { ImportStock } from "../ImportStock";
import { RetourForm } from "../RetourForm";
import { SectionStaging } from "../SectionStaging";
import { RetourStaging } from "../RetourStaging";
import { StockCrud } from "../StockCrud";

export const dynamic = "force-dynamic";

export default async function ReceptionPage() {
  const [stats, stock, clients] = await Promise.all([
    statsStock(),
    fetchStockActif(),
    listClientsPourStock(),
  ]);
  const compte = (s: string) => stats.parStatut.find((x) => x.statut === s)?.count ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Staging"
        title="Réception"
        kpis={[
          { value: compte("EN_STOCK"), label: "en stock" },
          { value: compte("CONFIGURE"), label: "configurés", color: "var(--ev-blue)" },
          { value: compte("RETOUR"), label: "retours", color: "var(--ev-purple)" },
        ]}
      />

      <RetourStaging />

      <SectionStaging
        couleur="var(--ev-blue)"
        icone={<Boxes className="size-4" />}
        titre="Matériel en stock"
        compteur={stock.length}
      >
        <StockCrud articles={stock} types={stats.types} clients={clients} />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-cyan)"
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
