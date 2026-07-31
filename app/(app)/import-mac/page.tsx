import { fetchLots } from "@/lib/repositories/lotsRepository";
import { listClientsActifs } from "@/lib/repositories/provisionningRepository";
import {
  buildExport,
  nomFichierExport,
  parseScope,
  repartitionParClient,
} from "@/lib/exports/exportService";
import { ExportPreviewTables, ExportScopeBar } from "../exports/ExportPreview";
import { PageHero } from "@/components/PageHero";

export const dynamic = "force-dynamic";

export default async function ImportMacPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = parseScope(params);
  const [{ entetes, rows, ecarts }, nomFichier, lots, clients] = await Promise.all([
    buildExport("mac", scope),
    nomFichierExport("mac", scope),
    fetchLots(),
    listClientsActifs(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-amber)"
        label="Import MAC"
        title="Parc<br />à déclarer"
        description="Une ligne par MAC éligible, bornes DECT incluses, dans l'ordre de saisie et dédoublonnée par client."
        kpis={[
          { value: rows.length, label: "MAC exportées" },
          {
            value: ecarts.length,
            label: "écartée",
            color: ecarts.length > 0 ? "var(--ev-red)" : undefined,
          },
        ]}
      />
      <ExportScopeBar
        type="mac"
        lots={lots.map((l) => ({ id: l.id, nom: l.nom }))}
        clients={clients}
        nomFichier={nomFichier}
      />
      <ExportPreviewTables
        entetes={entetes}
        rows={rows}
        repartition={repartitionParClient(rows)}
        ecarts={ecarts}
      />
    </main>
  );
}
