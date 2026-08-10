import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  fetchComptes,
  fetchEtapes,
  fetchEtapesMigrationParam,
  fetchListesValeurs,
  fetchModeles,
  fetchSyncRuns,
} from "@/lib/repositories/parametresRepository";
import { fetchModelesMailParam, getParametreApp } from "@/lib/repositories/mailRepository";
import { fetchActiviteEquipe } from "@/lib/repositories/activiteRepository";
import { SectionActivite } from "./SectionActivite";
import {
  SectionComptes,
  SectionControle,
  SectionEnvoiMail,
  SectionEtapes,
  SectionEtapesMigration,
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

  const [modeles, listes, etapes, etapesMigration, modelesMail, comptes, syncRuns, activite, signatureMail, copieMail] =
    await Promise.all([
      fetchModeles(),
      fetchListesValeurs(),
      fetchEtapes(),
      fetchEtapesMigrationParam(),
      fetchModelesMailParam(),
      fetchComptes(),
      fetchSyncRuns(),
      fetchActiviteEquipe(),
      getParametreApp("signatureMail"),
      getParametreApp("copieMail"),
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
      <SectionEnvoiMail signature={signatureMail ?? ""} copie={copieMail ?? ""} />
      <SectionModelesMail modeles={modelesMail} />
      <SectionListes listes={listes} />
      <SectionEtapes etapes={etapes} />
      <SectionComptes comptes={comptes} />
      <SectionSync syncRuns={syncRuns} />
      <SectionControle />
    </main>
  );
}
