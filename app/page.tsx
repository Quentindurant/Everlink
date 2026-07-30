import { fetchProvisionningLignes, type ProvisionningFiltres } from "@/lib/repositories/provisionningRepository";
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
  const lignes = await fetchProvisionningLignes(filtres);
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Provisionning</h1>
      <ProvisionningFiltresBar />
      <ProvisionningTable lignes={lignes} />
    </main>
  );
}
