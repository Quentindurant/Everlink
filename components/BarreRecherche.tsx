"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Filtre local d'une liste déjà chargée : la frappe n'appelle pas le serveur, on ne paie
// donc aucune requête. Le compteur dit ce qui reste visible, la croix remet tout.
export function BarreRecherche({
  valeur,
  onChange,
  placeholder,
  nbVisibles,
  nbTotal,
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  nbVisibles: number;
  nbTotal: number;
}) {
  const filtre = valeur.trim().length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-8 text-sm"
        />
        {filtre && (
          <button
            onClick={() => onChange("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            title="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {filtre ? `${nbVisibles} / ${nbTotal}` : nbTotal}
      </span>
    </div>
  );
}

// Normalise pour comparer sans se soucier de la casse ni des accents : « Mikrotik » doit
// répondre à « mikro », et un numéro de série se cherche aussi bien en majuscules.
export function normaliserRecherche(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Vrai si tous les mots saisis se retrouvent dans l'un des champs proposés : « ardi t54 »
// trouve la ligne du client ARDI portant un Yealink T54W, quel que soit l'ordre.
export function correspond(champs: (string | null | undefined)[], recherche: string): boolean {
  const mots = normaliserRecherche(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const foin = normaliserRecherche(champs.filter(Boolean).join(" "));
  return mots.every((m) => foin.includes(m));
}
