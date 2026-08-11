import { auth } from "@/auth";
import { fetchChefProjet } from "@/lib/repositories/chefProjetRepository";
import { PageHero } from "@/components/PageHero";
import { ChecklistProjet } from "./ChecklistProjet";
import { FiltresProjet } from "./FiltresProjet";

export const dynamic = "force-dynamic";

export default async function ChefProjetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [vue, session] = await Promise.all([
    fetchChefProjet({ recherche: params.q, avecClos: params.clos === "1" }),
    auth(),
  ]);

  const monEmail = session?.user?.email ?? "";
  const aMoi = vue.dossiers.filter((d) => d.attribueA === monEmail).length;
  const prets = vue.dossiers.filter((d) => d.pourcentage === 100 && !d.closLe).length;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-purple)"
        label="Chef projet"
        title="Préparation des migrations"
        kpis={[
          { value: vue.dossiers.length, label: "dossiers" },
          { value: aMoi, label: "à moi", color: "var(--ev-blue)" },
          { value: prets, label: "prêts", color: "var(--ev-green)" },
        ]}
      />
      <FiltresProjet nbClos={vue.nbClos} />
      <ChecklistProjet vue={vue} monEmail={monEmail} />
    </main>
  );
}
