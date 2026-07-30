import { fetchTelephoneGrille } from "@/lib/repositories/telephoneRepository";
import { listClientsActifs } from "@/lib/repositories/provisionningRepository";
import { TelephoneFiltres } from "./TelephoneFiltres";
import { TelephoneGrille } from "./TelephoneGrille";

export const dynamic = "force-dynamic";

export default async function TelephonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [grille, clients] = await Promise.all([
    fetchTelephoneGrille({ clientId: params.client, recherche: params.q }),
    listClientsActifs(),
  ]);
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Everlink
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Téléphone</h1>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {grille.utilisateurs.length} utilisateur{grille.utilisateurs.length > 1 ? "s" : ""} ·{" "}
          {grille.etapes.length} étape{grille.etapes.length > 1 ? "s" : ""}
        </p>
      </header>
      <TelephoneFiltres clients={clients} />
      <TelephoneGrille grille={grille} />
    </main>
  );
}
