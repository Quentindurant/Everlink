import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  fetchComptes,
  fetchEtapes,
  fetchEtapesMigrationParam,
  fetchEtapesProjetParam,
  fetchListesValeurs,
  fetchModeles,
  fetchSyncRuns,
} from "@/lib/repositories/parametresRepository";
import { fetchModelesMailParam, fetchPartenaireEnvoi } from "@/lib/repositories/mailRepository";
import { idPartenaireActif } from "@/lib/partenaire";
import { fetchActiviteEquipe } from "@/lib/repositories/activiteRepository";
import { SectionActivite } from "./SectionActivite";
import {
  SectionComptes,
  SectionControle,
  SectionEnvoiMail,
  SectionEtapes,
  SectionEtapesMigration,
  SectionEtapesProjet,
  SectionListes,
  SectionModeles,
  SectionModelesMail,
  SectionSync,
} from "./ParametresSections";
import { PageHero } from "@/components/PageHero";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  // Les réglages d'envoi et les modèles de mail suivent le partenaire choisi dans la barre
  // latérale, comme le reste de l'application.
  const idPartenaire = await idPartenaireActif();
  const [modeles, listes, etapes, etapesMigration, etapesProjet, modelesMail, comptes, syncRuns, activite, partenaire] =
    await Promise.all([
      fetchModeles(),
      fetchListesValeurs(),
      fetchEtapes(),
      fetchEtapesMigrationParam(),
      fetchEtapesProjetParam(),
      fetchModelesMailParam(idPartenaire),
      fetchComptes(),
      fetchSyncRuns(),
      fetchActiviteEquipe(),
      fetchPartenaireEnvoi(idPartenaire),
    ]);

  const nbAQualifier = modeles.filter((m) => !m.eligibleExport && m.nbEquipements === 0).length;

  return (
    <main className="flex flex-1 flex-col gap-8 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-text-secondary)"
        label="Paramètres"
        title="Le vocabulaire<br />de l'outil"
        description="Les couleurs vues partout dans l'app viennent d'ici. Une valeur utilisée se désactive, elle ne se supprime pas."
        kpis={[
          { value: modeles.length, label: "modèles" },
          {
            value: nbAQualifier,
            label: "à qualifier",
            color: nbAQualifier > 0 ? "var(--ev-red)" : undefined,
          },
        ]}
      />
      <SectionActivite activite={activite} />
      <SectionModeles modeles={modeles} />
      <SectionEtapesMigration etapes={etapesMigration} />
      <SectionEtapesProjet etapes={etapesProjet} />
      <SectionEnvoiMail partenaire={partenaire} />
      <SectionModelesMail modeles={modelesMail} nomPartenaire={partenaire?.nom ?? null} />
      <SectionListes listes={listes} />
      <SectionEtapes etapes={etapes} />
      <SectionComptes comptes={comptes} />
      <SectionSync syncRuns={syncRuns} />
      <SectionControle />
    </main>
  );
}
