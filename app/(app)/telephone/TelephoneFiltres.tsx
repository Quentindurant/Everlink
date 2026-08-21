"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TOUS = "tous";

// Où en est le dossier, du point de vue du technicien qui cherche quoi attaquer.
const AVANCEMENTS = [
  { value: "non_commence", label: "Pas commencés" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminés (100 %)" },
];

export function TelephoneFiltres({
  clients,
}: {
  clients: { id: string; raisonSociale: string }[];
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
      router.push(`/telephone?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Rechercher un utilisateur ou une raison sociale…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => setParam("q", e.target.value), 300);
          }}
        />
      </div>
      <Select
        items={[
          { value: TOUS, label: "Avancement : tous" },
          ...AVANCEMENTS.map((a) => ({ value: a.value, label: a.label })),
        ]}
        defaultValue={searchParams.get("avancement") ?? TOUS}
        onValueChange={(v) => setParam("avancement", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Avancement : tous</SelectItem>
          {AVANCEMENTS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
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
        onValueChange={(v) => setParam("client", v === TOUS || v === null ? "" : (v as string))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUS}>Client : tous</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.raisonSociale}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
