"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientListeLigne } from "@/lib/repositories/clientsRepository";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { EtapeMigrationSelect } from "@/components/migration/EtapeMigrationSelect";

const TOUS = "tous";

export function ClientsFiltres({
  lots,
  etapes,
}: {
  lots: { id: string; nom: string }[];
  etapes: EtapeMigrationLite[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/clients?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Rechercher une raison sociale, un groupe, une adresse…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => setParam("q", e.target.value), 300);
          }}
        />
      </div>
      <Select
        items={[
          { value: TOUS, label: "Lot : tous" },
          ...lots.map((l) => ({ value: l.id, label: l.nom })),
        ]}
        defaultValue={searchParams.get("lot") ?? TOUS}
        onValueChange={(v) => setParam("lot", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Lot : tous</SelectItem>
          {lots.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Étape : toutes" },
          ...etapes.map((e) => ({ value: e.id, label: e.libelle })),
        ]}
        defaultValue={searchParams.get("etape") ?? TOUS}
        onValueChange={(v) => setParam("etape", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Étape : toutes</SelectItem>
          {etapes.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Lien : tous" },
          { value: "NON_COMMANDE", label: "Non commandé" },
          { value: "COMMANDE", label: "Commandé" },
          { value: "LIVRE", label: "Livré" },
        ]}
        defaultValue={searchParams.get("lien") ?? TOUS}
        onValueChange={(v) => setParam("lien", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Lien : tous</SelectItem>
          <SelectItem value="NON_COMMANDE">Non commandé</SelectItem>
          <SelectItem value="COMMANDE">Commandé</SelectItem>
          <SelectItem value="LIVRE">Livré</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const LIEN_CLASSES: Record<string, string> = {
  NON_COMMANDE: "bg-muted text-muted-foreground",
  COMMANDE: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  LIVRE: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
};
const LIEN_LABEL: Record<string, string> = {
  NON_COMMANDE: "Non commandé",
  COMMANDE: "Commandé",
  LIVRE: "Livré",
};

export function ClientsTable({
  clients,
  etapes,
}: {
  clients: ClientListeLigne[];
  etapes: EtapeMigrationLite[];
}) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucun client. Ajustez les filtres ou lancez un import.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            {[
              "Raison sociale",
              "Étape",
              "Lien",
              "Lot",
              "Numéros",
              "MAC saisis",
              "MAC distincts",
              "Bascules",
              "Scénario",
              "Postes annoncés",
              "Écart postes",
              "Contact",
              "Adresse",
            ].map((h) => (
              <TableHead
                key={h}
                className="h-9 text-xs font-semibold whitespace-nowrap text-muted-foreground"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium whitespace-nowrap">
                <Link href={`/clients/${c.id}`} className="hover:underline">
                  {c.raisonSociale}
                </Link>
                {(c.groupe || c.filiale) && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {[c.groupe, c.filiale].filter(Boolean).join(" · ")}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <EtapeMigrationSelect
                  clientId={c.id}
                  etapeCouranteId={c.etape?.id ?? null}
                  etapes={etapes}
                />
              </TableCell>
              <TableCell>
                {c.avecLien ? (
                  <span
                    className={cn(
                      "rounded-lg px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                      LIEN_CLASSES[c.statutLien]
                    )}
                  >
                    {LIEN_LABEL[c.statutLien]}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{c.lotNom ?? "—"}</TableCell>
              <TableCell className="tabular-nums">{c.nbNumeros}</TableCell>
              <TableCell className="tabular-nums">{c.nbMacSaisis}</TableCell>
              <TableCell className="tabular-nums">
                {c.nbMacDistincts}
                {c.nbMacDistincts !== c.nbMacSaisis && (
                  <span className="ml-1 text-xs text-[color:var(--pal-amber-fg)]">
                    (partagées)
                  </span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {c.nbBasculesFaites}/{c.nbNumeros}
              </TableCell>
              <TableCell className="whitespace-nowrap">{c.scenario ?? "—"}</TableCell>
              <TableCell className="tabular-nums">{c.nbPostesAnnonce ?? "—"}</TableCell>
              <TableCell className="tabular-nums">
                {c.ecartPostes === null ? (
                  "—"
                ) : c.ecartPostes === 0 ? (
                  <span className="text-[color:var(--pal-green-fg)]">0</span>
                ) : (
                  <span className="font-medium text-[color:var(--pal-amber-fg)]">
                    {c.ecartPostes > 0 ? `+${c.ecartPostes}` : c.ecartPostes}
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{c.contact ?? "—"}</TableCell>
              <TableCell className="max-w-64 truncate" title={c.adresse ?? undefined}>
                {c.adresse ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
