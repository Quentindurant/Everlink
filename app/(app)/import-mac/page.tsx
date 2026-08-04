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
  const [
    { rows, reseauRows, ecarts, previewEntetes, previewRows, previewReseauRows },
    nomFichier,
    lots,
    clients,
  ] = await Promise.all([
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
        description="Téléphones, pieuvres et DECT dans l'onglet principal; switch, routeurs, OneAccess et 4G dans l'onglet Réseau. MAC formatées, dédoublonnées par client."
        kpis={[
          { value: rows.length, label: "MAC téléphonie" },
          { value: reseauRows.length, label: "MAC réseau", color: "var(--ev-cyan)" },
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
        entetes={previewEntetes}
        rows={previewRows}
        repartition={repartitionParClient(rows)}
        ecarts={ecarts}
        reseauEntetes={previewEntetes}
        reseauRows={previewReseauRows}
      />
    </main>
  );
}
