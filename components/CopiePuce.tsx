"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Valeur copiable en un clic (numéro, MAC, clé WiFi, plage DHCP…) : le technicien colle
// directement dans l'outil de configuration. Feedback ✓ une seconde.
export function CopiePuce({
  valeur,
  titre,
  libelle,
}: {
  valeur: string;
  titre?: string;
  /** Texte affiché à la place de la valeur, quand celle-ci est trop longue à lire. */
  libelle?: string;
}) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(valeur);
        setCopie(true);
        setTimeout(() => setCopie(false), 1000);
      }}
      title={titre ? `${titre} — cliquer pour copier` : "Cliquer pour copier"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:cursor-pointer",
        copie
          ? "border-transparent bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
          : "border-[color:var(--ev-card-border)] text-[color:var(--ev-body-secondary)] hover:bg-muted"
      )}
    >
      {copie ? <Check className="size-2.5" /> : <Copy className="size-2.5 opacity-50" />}
      {libelle ?? valeur}
    </button>
  );
}
