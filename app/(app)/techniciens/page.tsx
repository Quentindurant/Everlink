import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchAdvOverview,
  fetchTechniciens,
  fetchTechniciensDisponibles,
  listPrestataires,
} from "@/lib/repositories/technicienRepository";
import { PageHero } from "@/components/PageHero";
import { DispoFiltre, TechniciensManager } from "./TechniciensManager";
import { ImportTechniciens } from "./ImportTechniciens";
import { ZohoLiveView } from "./ZohoLiveView";

export const dynamic = "force-dynamic";

export default async function ADVPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? new Date().toISOString().slice(0, 10);
  const departement = params.dep ?? "";

  const [overview, techniciens, prestataires, disponibles] = await Promise.all([
    fetchAdvOverview(),
    fetchTechniciens(),
    listPrestataires(),
    fetchTechniciensDisponibles(new Date(dateStr), departement || undefined),
  ]);

  const nbActifs = techniciens.filter((t) => t.actif).length;

  return (
    <main className="flex flex-1 flex-col gap-6 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-cyan)"
        label="ADV"
        title="Pilotage<br />des dossiers"
        kpis={[
          { value: overview.affectes.length, label: "affectés" },
          { value: disponibles.length, label: "techs libres ce jour", color: "var(--ev-green)" },
          { value: overview.liens.commande, label: "liens commandés", color: "var(--ev-amber)" },
        ]}
      />

      {/* Vue live du tableau Zoho */}
      <ZohoLiveView />

      {/* Avancement portabilité (étapes) + commandes de lien */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Portabilité — par étape</h2>
          <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3 shadow-xs">
            {overview.parEtape.map((e) => (
              <span
                key={e.libelle}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ background: e.couleur }}
              >
                {e.libelle}
                <span className="rounded bg-black/20 px-1 tabular-nums">{e.count}</span>
              </span>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Commandes de lien</h2>
          <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3 shadow-xs">
            <Badge variant="outline" className="tabular-nums">Non commandé : {overview.liens.nonCommande}</Badge>
            <Badge className="border-transparent bg-blue-500/15 text-blue-700 tabular-nums dark:text-blue-400">
              Commandé : {overview.liens.commande}
            </Badge>
            <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 tabular-nums dark:text-emerald-400">
              Livré : {overview.liens.livre}
            </Badge>
          </div>
        </section>
      </div>

      {/* Techniciens affectés */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Techniciens affectés</h2>
        {overview.affectes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun technicien affecté. Affectez-en depuis une fiche client.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Client", "Technicien", "Date intervention", "Étape"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.affectes.map((a) => (
                  <TableRow key={a.clientId}>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${a.clientId}`} className="hover:underline">{a.raisonSociale}</Link>
                    </TableCell>
                    <TableCell>{a.technicienNom}</TableCell>
                    <TableCell className="tabular-nums">
                      {a.dateIso ? new Date(a.dateIso).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>{a.etape ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Disponibilité */}
      <section className="flex flex-col gap-2">
        <DispoFiltre date={dateStr} departement={departement} />
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
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{t.departements.join("/")}</span>
                )}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Référentiel + import */}
      <ImportTechniciens />
      <TechniciensManager techniciens={techniciens} prestataires={prestataires} />
    </main>
  );
}
