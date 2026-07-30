import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  fetchComptes,
  fetchEtapes,
  fetchListesValeurs,
  fetchModeles,
  fetchSyncRuns,
} from "@/lib/repositories/parametresRepository";
import {
  SectionComptes,
  SectionControle,
  SectionEtapes,
  SectionListes,
  SectionModeles,
  SectionSync,
} from "./ParametresSections";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [modeles, listes, etapes, comptes, syncRuns] = await Promise.all([
    fetchModeles(),
    fetchListesValeurs(),
    fetchEtapes(),
    fetchComptes(),
    fetchSyncRuns(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      </header>
      <SectionModeles modeles={modeles} />
      <SectionListes listes={listes} />
      <SectionEtapes etapes={etapes} />
      <SectionComptes comptes={comptes} />
      <SectionSync syncRuns={syncRuns} />
      <SectionControle />
    </main>
  );
}
