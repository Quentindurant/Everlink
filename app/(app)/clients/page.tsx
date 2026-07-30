import { fetchClientsListe } from "@/lib/repositories/clientsRepository";
import { fetchLots } from "@/lib/repositories/lotsRepository";
import { ClientsFiltres, ClientsTable } from "./ClientsTable";

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
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Everlink
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {clients.length} client{clients.length > 1 ? "s" : ""}
        </p>
      </header>
      <ClientsFiltres lots={lots.map((l) => ({ id: l.id, nom: l.nom }))} />
      <ClientsTable clients={clients} />
    </main>
  );
}
