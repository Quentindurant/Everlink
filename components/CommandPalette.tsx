"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Resultat {
  type: string;
  libelle: string;
  detail: string;
  href: string;
}

const PAGES: Resultat[] = [
  { type: "Page", libelle: "Accueil — vue du jour", detail: "", href: "/accueil" },
  { type: "Page", libelle: "Provisionning", detail: "", href: "/" },
  { type: "Page", libelle: "Clients", detail: "", href: "/clients" },
  { type: "Page", libelle: "Téléphone", detail: "", href: "/telephone" },
  { type: "Page", libelle: "Pilotage dossiers (ADV)", detail: "", href: "/techniciens" },
  { type: "Page", libelle: "Stock & routeurs (Staging)", detail: "", href: "/staging" },
  { type: "Page", libelle: "Export SDA", detail: "", href: "/import-sda" },
  { type: "Page", libelle: "Export MAC", detail: "", href: "/import-mac" },
];

const COULEUR_TYPE: Record<string, string> = {
  Page: "bg-muted text-muted-foreground",
  Client: "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]",
  Utilisateur: "bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]",
  "Numéro": "bg-[var(--pal-cyan-bg)] text-[color:var(--pal-cyan-fg)]",
  MAC: "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
  Stock: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
};

export function CommandPalette() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>(PAGES);
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ouverture au raccourci clavier (partout) ou via l'event custom du bouton sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert((o) => !o);
      }
      if (e.key === "Escape") setOuvert(false);
    };
    const onOuvrir = () => setOuvert(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ouvrir-palette", onOuvrir);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ouvrir-palette", onOuvrir);
    };
  }, []);

  useEffect(() => {
    if (ouvert) {
      setQ("");
      setResultats(PAGES);
      setActif(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [ouvert]);

  const chercher = useCallback((valeur: string) => {
    setQ(valeur);
    setActif(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    const t = valeur.trim();
    if (t.length < 2) {
      setResultats(PAGES.filter((p) => p.libelle.toLowerCase().includes(t.toLowerCase())));
      return;
    }
    // Petit debounce pour ne pas mitrailler l'API à chaque frappe.
    timerRef.current = setTimeout(async () => {
      const pages = PAGES.filter((p) => p.libelle.toLowerCase().includes(t.toLowerCase()));
      try {
        const r = await fetch(`/api/recherche?q=${encodeURIComponent(t)}`);
        const d = (await r.json()) as { resultats?: Resultat[] };
        setResultats([...pages, ...(d.resultats ?? [])]);
      } catch {
        setResultats(pages);
      }
    }, 180);
  }, []);

  const aller = (r: Resultat) => {
    setOuvert(false);
    router.push(r.href);
  };

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => setOuvert(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[10px] border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => chercher(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActif((a) => Math.min(a + 1, resultats.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActif((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && resultats[actif]) {
                aller(resultats[actif]);
              }
            }}
            placeholder="Client, utilisateur, numéro, MAC, n° série…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {resultats.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun résultat.</li>
          ) : (
            resultats.map((r, i) => (
              <li key={`${r.type}-${r.libelle}-${i}`}>
                <button
                  onClick={() => aller(r)}
                  onMouseEnter={() => setActif(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                    i === actif && "bg-muted"
                  )}
                >
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", COULEUR_TYPE[r.type] ?? "bg-muted")}>
                    {r.type}
                  </span>
                  <span className="flex-1 truncate font-medium">{r.libelle}</span>
                  {r.detail && <span className="truncate text-xs text-muted-foreground">{r.detail}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          ↑↓ naviguer · Entrée ouvrir · Ctrl/⌘+K fermer
        </div>
      </div>
    </div>
  );
}
