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
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Import SDA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prévisualisation exacte du fichier généré : une ligne par numéro rattaché à un
          utilisateur équipé d'un modèle éligible, triée par raison sociale.
        </p>
      </header>
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
