import {
  fetchClientsSansLignes,
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
  // Un filtre au niveau ligne (hébergeur, statut, éligible, anomalie) ne peut par nature pas
  // matcher un client vide: on ne propose les clients sans lignes que hors de ces filtres.
  const filtreLigneActif =
    !!params.hebergeur || !!params.statut || params.eligible === "1" || params.anomalie === "1";
  const clientsSansLignes = filtreLigneActif
    ? []
    : await fetchClientsSansLignes([...new Set(lignes.map((l) => l.clientId))], {
        lotId: params.lot,
        clientId: params.client,
        recherche: params.q,
      });
  const nbNumeros = lignes.filter((l) => l.numeroId).length;
  const nbClients = new Set(lignes.map((l) => l.clientId)).size + clientsSansLignes.length;
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Everlink
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Provisionning</h1>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {nbNumeros} numéro{nbNumeros > 1 ? "s" : ""} · {nbClients} client
          {nbClients > 1 ? "s" : ""}
        </p>
      </header>
      <ProvisionningFiltresBar
        lots={lots}
        clients={clients}
        valeursStatutBascule={valeursStatutBascule}
      />
      <ProvisionningTable
        lignes={lignes}
        clientsSansLignes={clientsSansLignes}
        valeursStatutBascule={valeursStatutBascule}
      />
    </main>
  );
}
