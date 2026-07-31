import {
  fetchClientsSansLignes,
  fetchProvisionningLignes,
  listClientsActifs,
  listLotsActifs,
  listModelesActifs,
  listValeursStatutBascule,
  type ProvisionningFiltres,
} from "@/lib/repositories/provisionningRepository";
import {
  listEtapesMigration,
  mapEtapeParClient,
} from "@/lib/repositories/migrationRepository";
import { ProvisionningTable } from "@/app/provisionning/ProvisionningTable";
import { ProvisionningFiltresBar } from "@/app/provisionning/ProvisionningFiltres";
import { PageHero } from "@/components/PageHero";

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
  const [lignes, lots, clients, valeursStatutBascule, modeles, etapesMigration, etapeParClient] =
    await Promise.all([
      fetchProvisionningLignes(filtres),
      listLotsActifs(),
      listClientsActifs(),
      listValeursStatutBascule(),
      listModelesActifs(),
      listEtapesMigration(),
      mapEtapeParClient(),
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
  const nbBascules = lignes.filter(
    (l) => l.statutBascule === "Fait"
  ).length;
  const nbAnomalies = lignes.filter(
    (l) => l.controleNiveau === "ERREUR"
  ).length;
  const nbClientsSansLignes = clientsSansLignes.length;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Provisioning"
        title="Les numéros<br />en mouvement"
        description="Un numéro, un trajet : saisie, contrôle, export, bascule. Tout ce qui bloque est rouge."
        kpis={[
          { value: nbNumeros, label: nbNumeros > 1 ? "numéros suivis" : "numéro suivi" },
          { value: nbBascules, label: nbBascules > 1 ? "basculés" : "basculé" },
          {
            value: nbAnomalies,
            label: nbAnomalies > 1 ? "anomalies" : "anomalie",
            color: "var(--ev-red)",
          },
          {
            value: nbClientsSansLignes,
            label: nbClientsSansLignes > 1 ? "clients sans ligne" : "client sans ligne",
            color: "var(--ev-text-secondary)",
          },
        ]}
      />
      <ProvisionningFiltresBar
        lots={lots}
        clients={clients}
        valeursStatutBascule={valeursStatutBascule}
      />
      <ProvisionningTable
        lignes={lignes}
        clientsSansLignes={clientsSansLignes}
        valeursStatutBascule={valeursStatutBascule}
        modeles={modeles}
        etapesMigration={etapesMigration}
        etapeParClient={etapeParClient}
      />
    </main>
  );
}
