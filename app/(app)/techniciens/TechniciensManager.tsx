"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TechnicienLigne } from "@/lib/repositories/technicienRepository";
import {
  creerTechnicienAction,
  supprimerTechnicienAction,
  updateTechnicienAction,
} from "./actions";

export function TechniciensManager({
  techniciens,
  prestataires,
}: {
  techniciens: TechnicienLigne[];
  prestataires: { id: string; nom: string }[];
}) {
  const [nom, setNom] = useState("");
  const [prestataireId, setPrestataireId] = useState("");
  const [deps, setDeps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input placeholder="Nom du technicien" value={nom} onChange={(e) => setNom(e.target.value)} className="w-52" />
        <select
          value={prestataireId}
          onChange={(e) => setPrestataireId(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Prestataire…</option>
          {prestataires.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))}
        </select>
        <Input placeholder="Départements (78 95 …)" value={deps} onChange={(e) => setDeps(e.target.value)} className="w-44" />
        <Button
          size="sm"
          disabled={!nom.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await creerTechnicienAction(nom, prestataireId, deps);
              if (r.success) { setNom(""); setDeps(""); setErreur(null); }
              else setErreur(r.error ?? null);
            })
          }
        >
          <Plus data-icon="inline-start" />
          Ajouter
        </Button>
        {erreur && <span className="text-sm text-destructive">{erreur}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Nom", "Prestataire", "Départements", "Actif", ""].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {techniciens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Aucun technicien. Ajoutez-en ci-dessus.
                </TableCell>
              </TableRow>
            ) : (
              techniciens.map((t) => (
                <TableRow key={t.id} className={t.actif ? "" : "opacity-50"}>
                  <TableCell className="font-medium">
                    <input
                      defaultValue={t.nom}
                      onBlur={(e) => {
                        if (e.target.value !== t.nom && e.target.value.trim())
                          startTransition(async () => { await updateTechnicienAction(t.id, { nom: e.target.value }); });
                      }}
                      className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40"
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      defaultValue={t.prestataireId ?? ""}
                      onChange={(e) => startTransition(async () => { await updateTechnicienAction(t.id, { prestataireId: e.target.value }); })}
                      className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none hover:border-input focus:border-ring"
                    >
                      <option value="">—</option>
                      {prestataires.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <input
                      defaultValue={t.departements.join(" ")}
                      placeholder="tous"
                      onBlur={(e) => {
                        if (e.target.value !== t.departements.join(" "))
                          startTransition(async () => { await updateTechnicienAction(t.id, { departements: e.target.value }); });
                      }}
                      className="w-32 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[13px] outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40"
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={t.actif}
                      onCheckedChange={(v) => startTransition(async () => { await updateTechnicienAction(t.id, { actif: Boolean(v) }); })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startTransition(async () => {
                        const r = await supprimerTechnicienAction(t.id);
                        if (!r.success) setErreur(r.error ?? null);
                      })}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function DispoFiltre({ date, departement }: { date: string; departement: string }) {
  const [d, setD] = useState(date);
  const [dep, setDep] = useState(departement);
  const [, startTransition] = useTransition();

  const appliquer = (nd: string, ndep: string) => {
    const params = new URLSearchParams();
    if (nd) params.set("date", nd);
    if (ndep) params.set("dep", ndep);
    startTransition(() => {
      window.location.href = `/techniciens?${params.toString()}`;
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <span className="text-sm font-medium">Disponibilité le</span>
      <Input type="date" value={d} onChange={(e) => { setD(e.target.value); appliquer(e.target.value, dep); }} className="w-40" />
      <Input placeholder="Département (opt.)" value={dep} onChange={(e) => setDep(e.target.value)} onBlur={() => appliquer(d, dep)} className="w-40" />
      <Badge variant="outline">Techniciens libres ce jour-là</Badge>
    </div>
  );
}
