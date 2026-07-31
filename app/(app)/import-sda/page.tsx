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

export default async function ImportSdaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const scope = parseScope(params);
  const [{ entetes, rows, ecarts }, nomFichier, lots, clients] = await Promise.all([
    buildExport("sda", scope),
    nomFichierExport("sda", scope),
    fetchLots(),
    listClientsActifs(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-amber)"
        label="Import SDA"
        title="Fichier SDA<br />à générer"
        description="Une ligne par numéro rattaché à un utilisateur équipé d'un modèle éligible, triée par raison sociale."
        kpis={[
          { value: rows.length, label: "lignes exportées" },
          {
            value: ecarts.length,
            label: "écartées",
            color: ecarts.length > 0 ? "var(--ev-red)" : undefined,
          },
        ]}
      />
      <ExportScopeBar
        type="sda"
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
