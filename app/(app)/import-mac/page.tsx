import { fetchLots } from "@/lib/repositories/lotsRepository";
import { listClientsActifs } from "@/lib/repositories/provisionningRepository";
import {
  buildExport,
  nomFichierExport,
  parseScope,
  repartitionParClient,
} from "@/lib/exports/exportService";
import { ExportPreviewTables, ExportScopeBar } from "../exports/ExportPreview";

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
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Import MAC</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prévisualisation exacte du fichier généré : une ligne par MAC d'équipement éligible
          (bornes DECT incluses), dans l'ordre de saisie, dédoublonnée par client. Les MAC sont
          exportées telles que saisies.
        </p>
      </header>
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
