import { fetchTelephoneGrille } from "@/lib/repositories/telephoneRepository";
import { listClientsActifs } from "@/lib/repositories/provisionningRepository";
import { TelephoneFiltres } from "./TelephoneFiltres";
import { TelephoneGrille } from "./TelephoneGrille";
import { PageHero } from "@/components/PageHero";

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

  const totalUtilisateurs = grille.utilisateurs.length;
  const totalFait = totalUtilisateurs > 0 && grille.etapes.length > 0
    ? Math.round(
        (grille.utilisateurs.reduce(
          (acc, u) =>
            acc +
            Object.values(u.statuts).filter(
              (st) => st === "Fait" || st === "Sans objet"
            ).length,
          0
        ) /
          (totalUtilisateurs * grille.etapes.length)) *
          100
      )
    : 0;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="Téléphone"
        title="Poste<br />par poste"
        description="Chaque utilisateur suit les mêmes étapes. Cliquez pour avancer."
        kpis={[
          { value: totalUtilisateurs, label: totalUtilisateurs > 1 ? "utilisateurs" : "utilisateur" },
          {
            value: `${totalFait}%`,
            label: "fait",
            color: "var(--ev-text-secondary)",
          },
        ]}
      />
      <TelephoneFiltres clients={clients} />
      <TelephoneGrille grille={grille} />
    </main>
  );
}
