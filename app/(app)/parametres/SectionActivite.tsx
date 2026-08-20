import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActiviteEquipe } from "@/lib/repositories/activiteRepository";

function quand(iso: string | null): string {
  if (!iso) return "jamais connecté";
  const d = new Date(iso);
  const aujourdhui = new Date().toDateString() === d.toDateString();
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return aujourdhui ? `aujourd'hui à ${heure}` : `${d.toLocaleDateString("fr-FR")} à ${heure}`;
}

// Vue admin : qui est en ligne, qui fait quoi, journal récent. Alimentée par le journal
// d'activité (AuditLog) et la présence (derniereActiviteLe).
export function SectionActivite({ activite }: { activite: ActiviteEquipe }) {
  const { utilisateurs, recentes } = activite;
  const enLigne = utilisateurs.filter((u) => u.enLigne).length;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Activité de l&apos;équipe</h2>
        <p className="text-sm text-muted-foreground">
          {enLigne} connecté{enLigne > 1 ? "s" : ""} maintenant · classement sur les actions
          tracées (étapes, statuts, contacts, expéditions, tableau de suivi…)
        </p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1fr]">
        {/* Classement */}
        <div className="overflow-x-auto rounded-[10px] border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Utilisateur", "Présence", "7 jours", "Total"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilisateurs.map((u) => (
                <TableRow key={u.id} className={cn(!u.actif && "opacity-50")}>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium">{u.nom}</span>
                    <span className="ml-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {u.enLigne ? (
                      <span className="ev-badge bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]">
                        <span
                          className="ev-badge-dot ev-pulse"
                          style={{ background: "var(--pal-green-dot)" }}
                        />
                        en ligne
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{quand(u.dernierVuLe)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono text-[13px] font-bold tabular-nums",
                        u.actions7j > 0 ? "text-[color:var(--ev-accent-text)]" : "text-muted-foreground"
                      )}
                    >
                      {u.actions7j}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[13px] tabular-nums text-muted-foreground">
                    {u.actionsTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Journal récent */}
        <div className="overflow-hidden rounded-[10px] border bg-card">
          <div
            className="border-b px-4 py-2.5 text-[13px] font-bold"
            style={{ borderColor: "var(--ev-card-border-light)" }}
          >
            Dernières actions
          </div>
          {recentes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Rien pour l&apos;instant : le journal se remplit au fil des actions de l&apos;équipe.
            </p>
          ) : (
            <ul className="max-h-[420px] overflow-auto">
              {recentes.map((r, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 border-t px-4 py-1.5 text-[12.5px] first:border-t-0"
                  style={{ borderColor: "var(--ev-row-border)" }}
                >
                  <span className="shrink-0 font-medium">{r.auteurNom}</span>
                  <span className="truncate text-muted-foreground">
                    {r.action}
                    {r.apres ? ` · ${r.apres}` : ""}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground">
                    {quand(r.creeLe)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
