import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchImportRuns } from "@/lib/repositories/importMondayRepository";
import { ImportMondayForm } from "./ImportMondayForm";
import { PageHero } from "@/components/PageHero";
import { horodateParis } from "@/lib/domain/horodatage";

export const dynamic = "force-dynamic";

export default async function ImportMondayPage() {
  const [session, runs] = await Promise.all([auth(), fetchImportRuns()]);
  const estAdmin = session?.user?.role === "ADMIN";

  // Aggregate KPIs from last run
  const lastRun = runs[0];
  const lastRapport = lastRun?.rapport as {
    crees?: number;
    misAJour?: number;
    modelesCrees?: string[];
  } | undefined;
  const totalCrees = lastRapport?.crees ?? 0;

  return (
    <main className="flex flex-1 flex-col gap-4 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Import Monday"
        title="Le lot arrive<br />de Monday"
        description="Upload, prévisualisation du rapprochement, validation. Import idempotent : vos saisies ne sont jamais écrasées."
        kpis={[
          { value: totalCrees, label: totalCrees > 1 ? "clients créés" : "client créé", color: "var(--ev-green)" },
          { value: 0, label: "écrasés", color: "var(--ev-text-secondary)" },
        ]}
      />

      {estAdmin ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-[10px] border-2 border-dashed p-5.5"
          style={{
            background: "var(--ev-card)",
            borderColor: "var(--ev-sel-border)",
          }}
        >
          <span
            className="grid size-12 shrink-0 place-items-center rounded-[10px] font-mono text-sm font-semibold"
            style={{ background: "var(--ev-nav-active-bg)", color: "var(--ev-nav-active-fg)" }}
          >
            xls
          </span>
          <div className="min-w-[220px] flex-1">
            <div className="text-base font-bold">Déposez l&apos;export Monday ici</div>
            <div className="mt-0.5 text-[13px]" style={{ color: "var(--ev-body-muted)" }}>
              Aucun fichier sélectionné &middot; .xlsx uniquement &middot; rapprochement par raison sociale
            </div>
          </div>
          <ImportMondayForm />
        </div>
      ) : (
        <div
          className="rounded-[10px] border border-dashed p-6 text-sm"
          style={{ color: "var(--ev-body-muted)" }}
        >
          Import réservé aux administrateurs.
        </div>
      )}

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold tracking-[.02em] uppercase">
          Historique
        </h2>
        {runs.length === 0 ? (
          <p
            className="rounded-[10px] border border-dashed p-6 text-sm"
            style={{ color: "var(--ev-body-muted)" }}
          >
            Aucun import Monday pour l&apos;instant.
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-[10px] border shadow-sm"
            style={{
              background: "var(--ev-card)",
              borderColor: "var(--ev-card-border)",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Date", "Fichier", "Résultat", "Statut", "Auteur"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const rapport = run.rapport as {
                    crees?: number;
                    misAJour?: number;
                    ignores?: number;
                    modelesCrees?: string[];
                  };
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {horodateParis(run.creeLe)}
                      </TableCell>
                      <TableCell className="font-mono text-[13px]">{run.nomFichier}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {(rapport.crees ?? 0) > 0 && (
                            <span
                              className="ev-badge"
                              style={{ background: "var(--pal-green-bg)", color: "var(--pal-green-fg)" }}
                            >
                              <span className="ev-badge-dot" style={{ background: "var(--pal-green-dot)" }} />
                              {rapport.crees} créés
                            </span>
                          )}
                          <span className="ev-badge" style={{ background: "var(--pal-gray-bg)", color: "var(--pal-gray-fg)" }}>
                            {rapport.misAJour ?? 0} mis à jour
                          </span>
                          <span className="ev-badge" style={{ background: "var(--pal-gray-bg)", color: "var(--pal-gray-fg)" }}>
                            {rapport.ignores ?? 0} ignorés
                          </span>
                          {rapport.modelesCrees && rapport.modelesCrees.length > 0 && (
                            <span
                              className="ev-badge"
                              style={{ background: "var(--pal-violet-bg)", color: "var(--pal-violet-fg)" }}
                            >
                              <span className="ev-badge-dot" style={{ background: "var(--pal-violet-dot)" }} />
                              {rapport.modelesCrees.length} modèles
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.succes ? (
                          <span
                            className="ev-badge font-bold"
                            style={{ background: "var(--pal-green-bg)", color: "var(--pal-green-fg)" }}
                          >
                            OK
                          </span>
                        ) : (
                          <Badge className="border-transparent bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]">
                            Erreurs
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{run.auteur?.email ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
