"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { BarreRecherche, correspond } from "@/components/BarreRecherche";
import { PuceOperateur } from "@/components/PuceOperateur";

const COULEUR_LIEN: Record<string, string> = {
  Livré: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
  Commandé: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  "Non commandé": "bg-muted text-muted-foreground",
};

// Contenu de la section « À installer » : table nue, le titre est porté par la section.
// La recherche filtre en local sur client, matériel, N° de série et technicien.
export function AInstaller({ lignes }: { lignes: AInstallerLigne[] }) {
  const [recherche, setRecherche] = useState("");
  const visibles = useMemo(
    () =>
      lignes.filter((l) =>
        correspond([l.clientNom, l.type, l.numeroSerie, l.technicienNom, l.lienStatut], recherche)
      ),
    [lignes, recherche]
  );

  return (
    <div>
      <BarreRecherche
        valeur={recherche}
        onChange={setRecherche}
        placeholder="Client, matériel, N° de série, technicien…"
        nbVisibles={visibles.length}
        nbTotal={lignes.length}
      />
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {["Client", "Matériel", "Statut", "Lien", "Intervention", "Technicien"].map((h) => (
              <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibles.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {l.clientId ? (
                  <Link href={`/clients/${l.clientId}`} className="hover:underline">{l.clientNom}</Link>
                ) : (
                  <span>{l.clientNom}</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {l.type} <span className="font-mono text-muted-foreground">{l.numeroSerie}</span>{" "}
                <PuceOperateur type={l.type} numeroSerie={l.numeroSerie} />
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
                  <span className="text-xs text-muted-foreground">—</span>
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
      {visibles.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Aucun matériel ne correspond à cette recherche.
        </p>
      )}
    </div>
  );
}
