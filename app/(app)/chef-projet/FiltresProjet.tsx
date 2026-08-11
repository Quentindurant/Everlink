"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function FiltresProjet({ nbClos }: { nbClos: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avecClos = searchParams.get("clos") === "1";

  const pousser = (params: URLSearchParams) =>
    startTransition(() => router.push(`/chef-projet?${params.toString()}`));

  const chercher = (valeur: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (valeur) params.set("q", valeur);
      else params.delete("q");
      pousser(params);
    }, 300);
  };

  const basculerClos = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (avecClos) params.delete("clos");
    else params.set("clos", "1");
    pousser(params);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => chercher(e.target.value)}
          placeholder="Rechercher un client…"
          className="pl-8"
        />
      </div>
      <button
        onClick={basculerClos}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
          avecClos
            ? "border-transparent bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        {avecClos ? "Masquer les clos" : `Afficher les clos (${nbClos})`}
      </button>
    </div>
  );
}
