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

export const dynamic = "force-dynamic";

export default async function ImportMondayPage() {
  const [session, runs] = await Promise.all([auth(), fetchImportRuns()]);
  const estAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Import Monday</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload du xlsx Monday, prévisualisation du rapprochement, validation. Import
          idempotent : les champs saisis dans l'application ne sont jamais écrasés.
        </p>
      </header>

      {estAdmin ? (
        <ImportMondayForm />
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Import réservé aux administrateurs.
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Historique des imports</h2>
        {runs.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun import Monday pour l'instant.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
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
                        {run.creeLe.toISOString().slice(0, 16).replace("T", " ")}
                      </TableCell>
                      <TableCell className="font-mono text-[13px]">{run.nomFichier}</TableCell>
                      <TableCell className="text-sm">
                        {rapport.crees ?? 0} créés · {rapport.misAJour ?? 0} mis à jour ·{" "}
                        {rapport.ignores ?? 0} ignorés
                        {rapport.modelesCrees && rapport.modelesCrees.length > 0 && (
                          <> · {rapport.modelesCrees.length} modèle(s)</>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.succes ? (
                          <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            OK
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-destructive/15 text-destructive">
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
