import { Badge } from "@/components/ui/badge";
import {
  fetchTechniciens,
  fetchTechniciensDisponibles,
  listPrestataires,
} from "@/lib/repositories/technicienRepository";
import { PageHero } from "@/components/PageHero";
import { DispoFiltre, TechniciensManager } from "./TechniciensManager";
import { ImportTechniciens } from "./ImportTechniciens";

export const dynamic = "force-dynamic";

export default async function TechniciensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? new Date().toISOString().slice(0, 10);
  const departement = params.dep ?? "";

  const [techniciens, prestataires, disponibles] = await Promise.all([
    fetchTechniciens(),
    listPrestataires(),
    fetchTechniciensDisponibles(new Date(dateStr), departement || undefined),
  ]);

  const nbActifs = techniciens.filter((t) => t.actif).length;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="Techniciens"
        title="Qui est<br />disponible"
        kpis={[
          { value: nbActifs, label: nbActifs > 1 ? "techniciens actifs" : "technicien actif" },
          {
            value: disponibles.length,
            label: "libres ce jour",
            color: "var(--ev-green)",
          },
        ]}
      />

      <DispoFiltre date={dateStr} departement={departement} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Disponibles le {new Date(dateStr).toLocaleDateString("fr-FR")}
          {departement ? ` · dép. ${departement}` : ""}
        </h2>
        {disponibles.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun technicien disponible (tous affectés, ou aucun ne couvre ce département).
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {disponibles.map((t) => (
              <Badge key={t.id} variant="outline" className="px-3 py-1 text-sm">
                {t.nom}
                {t.departements.length > 0 && (
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                    {t.departements.join("/")}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <ImportTechniciens />
      <TechniciensManager techniciens={techniciens} prestataires={prestataires} />
    </main>
  );
}
