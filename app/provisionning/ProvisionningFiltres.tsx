"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Base UI Select n'accepte pas de valeur vide pour un item: "tous" sert de sentinelle
// et est retraduit en suppression du paramètre d'URL.
const TOUS = "tous";

export function ProvisionningFiltresBar({
  lots,
  clients,
  valeursStatutBascule,
}: {
  lots: { id: string; nom: string }[];
  clients: { id: string; raisonSociale: string }[];
  valeursStatutBascule: string[];
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
      router.push(`/provisionning?${params.toString()}`);
    });
  };

  const setParamDebounced = (key: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam(key, value), 300);
  };

  const setSelectParam = (key: string) => (value: string | null) => {
    setParam(key, value === TOUS || value === null ? "" : value);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2.5 rounded-[10px] border p-3"
      style={{
        background: "var(--ev-card)",
        borderColor: "var(--ev-card-border)",
      }}
    >
      <div className="relative min-w-[280px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 rounded-[7px] pl-9"
          style={{
            background: "var(--ev-input-bg)",
            borderColor: "var(--ev-input-border)",
            color: "var(--ev-body)",
          }}
          placeholder="Rechercher un numéro, une MAC, un utilisateur..."
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => setParamDebounced("q", e.target.value)}
        />
      </div>
      <Select
        items={[
          { value: TOUS, label: "Lot : tous" },
          ...lots.map((lot) => ({ value: lot.id, label: lot.nom })),
        ]}
        defaultValue={searchParams.get("lot") ?? TOUS}
        onValueChange={setSelectParam("lot")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Lot : tous</SelectItem>
          {lots.map((lot) => (
            <SelectItem key={lot.id} value={lot.id}>
              {lot.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Client : tous" },
          ...clients.map((c) => ({ value: c.id, label: c.raisonSociale })),
        ]}
        defaultValue={searchParams.get("client") ?? TOUS}
        onValueChange={setSelectParam("client")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Client : tous</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.raisonSociale}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Hébergeur : tous" },
          { value: "SEWAN", label: "SEWAN" },
          { value: "UNYC", label: "UNYC" },
        ]}
        defaultValue={searchParams.get("hebergeur") ?? TOUS}
        onValueChange={setSelectParam("hebergeur")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Hébergeur : tous</SelectItem>
          <SelectItem value="SEWAN">SEWAN</SelectItem>
          <SelectItem value="UNYC">UNYC</SelectItem>
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: TOUS, label: "Bascule : toutes" },
          ...valeursStatutBascule.map((v) => ({ value: v, label: v })),
        ]}
        defaultValue={searchParams.get("statut") ?? TOUS}
        onValueChange={setSelectParam("statut")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Bascule : toutes</SelectItem>
          {valeursStatutBascule.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors select-none has-[[data-checked]]:border-primary/40 has-[[data-checked]]:bg-primary/5 has-[[data-checked]]:text-foreground">
        <Checkbox
          defaultChecked={searchParams.get("anomalie") === "1"}
          onCheckedChange={(checked) => setParam("anomalie", checked ? "1" : "")}
        />
        Anomalies seulement
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors select-none has-[[data-checked]]:border-primary/40 has-[[data-checked]]:bg-primary/5 has-[[data-checked]]:text-foreground">
        <Checkbox
          defaultChecked={searchParams.get("eligible") === "1"}
          onCheckedChange={(checked) => setParam("eligible", checked ? "1" : "")}
        />
        Éligibles export seulement
      </label>
    </div>
  );
}
