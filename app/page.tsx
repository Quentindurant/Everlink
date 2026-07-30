import {
  fetchProvisionningLignes,
  listClientsActifs,
  listLotsActifs,
  listValeursStatutBascule,
  type ProvisionningFiltres,
} from "@/lib/repositories/provisionningRepository";
import { ProvisionningTable } from "@/app/provisionning/ProvisionningTable";
import { ProvisionningFiltresBar } from "@/app/provisionning/ProvisionningFiltres";

export const dynamic = "force-dynamic";

export default async function ProvisionningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filtres: ProvisionningFiltres = {
    lotId: params.lot,
    clientId: params.client,
    hebergeur: params.hebergeur,
    statutBascule: params.statut,
    eligibleExportSeulement: params.eligible === "1",
    avecAnomalieSeulement: params.anomalie === "1",
    recherche: params.q,
  };
  const [lignes, lots, clients, valeursStatutBascule] = await Promise.all([
    fetchProvisionningLignes(filtres),
    listLotsActifs(),
    listClientsActifs(),
    listValeursStatutBascule(),
  ]);
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Provisionning</h1>
      <ProvisionningFiltresBar
        lots={lots}
        clients={clients}
        valeursStatutBascule={valeursStatutBascule}
      />
      <ProvisionningTable lignes={lignes} valeursStatutBascule={valeursStatutBascule} />
    </main>
  );
}
