import { fetchClientsListe } from "@/lib/repositories/clientsRepository";
import { fetchLots } from "@/lib/repositories/lotsRepository";
import { ClientsFiltres, ClientsTable } from "./ClientsTable";
import { PageHero } from "@/components/PageHero";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [clients, lots] = await Promise.all([
    fetchClientsListe({ lotId: params.lot, recherche: params.q }),
    fetchLots(),
  ]);

  const nbPostesAnnonces = clients.reduce(
    (acc, c) => acc + (c.nbPostesAnnonce ?? 0),
    0
  );
  const nbPostesEcart = clients.reduce(
    (acc, c) => acc + Math.max(0, c.ecartPostes ?? 0),
    0
  );
  const nbEquipes = clients.filter((c) => c.nbMacSaisis > 0).length;

  // Count scenarios
  const scenarios = new Set(clients.map((c) => c.scenario).filter(Boolean));

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-purple)"
        label="Clients"
        title={`${clients.length} clients,<br />${scenarios.size} scénarios`}
        description="Regroupés par scénario de migration : c'est lui qui dicte le matériel et l'ordre des bascules."
        kpis={[
          { value: nbPostesAnnonces, label: nbPostesAnnonces > 1 ? "postes annoncés" : "poste annoncé" },
          {
            value: nbPostesEcart > 0 ? `+${nbPostesEcart}` : "0",
            label: "écart à saisir",
            color: nbPostesEcart > 0 ? "var(--ev-amber)" : undefined,
          },
          { value: nbEquipes, label: nbEquipes > 1 ? "clients équipés" : "client équipé", color: "var(--ev-text-secondary)" },
        ]}
      />
      <ClientsFiltres lots={lots.map((l) => ({ id: l.id, nom: l.nom }))} />
      <ClientsTable clients={clients} />
    </main>
  );
}
