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
import type { AInstallerLigne } from "@/lib/repositories/stockRepository";
import { LIBELLE_STATUT } from "@/lib/domain/stock/statuts";

const COULEUR_LIEN: Record<string, string> = {
  Livré: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
  Commandé: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  "Non commandé": "bg-muted text-muted-foreground",
};

export function AInstaller({ lignes }: { lignes: AInstallerLigne[] }) {
  if (lignes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
          À installer
        </h2>
        <Badge variant="outline" className="tabular-nums">{lignes.length}</Badge>
        <span className="text-xs text-muted-foreground">
          matériel configuré / envoyé, avec l&apos;état du lien et l&apos;intervention
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Client", "Matériel", "Statut", "Lien", "Intervention", "Technicien"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold whitespace-nowrap text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  {l.clientId ? (
                    <Link href={`/clients/${l.clientId}`} className="hover:underline">{l.clientNom}</Link>
                  ) : (
                    <span>{l.clientNom}</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {l.type} <span className="font-mono text-muted-foreground">{l.numeroSerie}</span>
                </TableCell>
                <TableCell>
                  <span className="rounded-lg bg-[var(--pal-amber-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--pal-amber-fg)]">
                    {LIBELLE_STATUT[l.statut] ?? l.statut}
                  </span>
                </TableCell>
                <TableCell>
                  {l.lienStatut ? (
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${COULEUR_LIEN[l.lienStatut] ?? ""}`}>
                      {l.lienStatut}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">non rattaché</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-xs">
                  {l.dateIntervention ? new Date(l.dateIntervention).toLocaleDateString("fr-FR") : "—"}
                </TableCell>
                <TableCell className="text-xs">{l.technicienNom ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
