"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { PartenaireLite } from "@/lib/partenaire";

// Le logo de la barre latérale est aussi le sélecteur de partenaire : cliquer dessus ouvre
// la liste, choisir bascule tout l'affichage. Le périmètre actif se lit donc là où l'œil va
// déjà, sans barre de filtre supplémentaire à chercher.
// Un partenaire sans fichier de logo s'affiche par son nom : mieux vaut du texte qu'une
// image cassée, et surtout que le logo d'un autre partenaire.
function Marque({ p, hauteur }: { p: PartenaireLite; hauteur: number }) {
  if (!p.logo) {
    return (
      <span
        className="font-bold tracking-tight"
        style={{ fontSize: hauteur * 0.8, color: "var(--ev-text-primary)" }}
      >
        {p.nom}
      </span>
    );
  }
  return (
    <Image
      src={p.logo}
      alt={p.nom}
      width={hauteur * 6.5}
      height={hauteur}
      unoptimized
      className="w-auto"
      style={{ height: hauteur }}
    />
  );
}

export function SelecteurPartenaire({
  actif,
  partenaires,
  onChoisir,
}: {
  actif: PartenaireLite;
  partenaires: PartenaireLite[];
  onChoisir: (code: string) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, startTransition] = useTransition();
  const conteneur = useRef<HTMLDivElement>(null);

  // Un clic ailleurs referme : le menu couvre la navigation, il ne doit pas rester ouvert.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  // Un seul partenaire configuré : le logo reste un logo, pas un menu qui ne mène nulle part.
  if (partenaires.length < 2) {
    return <Marque p={actif} hauteur={24} />;
  }

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-[var(--ev-nav-hover)]"
        title={`Partenaire actif : ${actif.nom} — cliquer pour changer`}
      >
        <Marque p={actif} hauteur={24} />
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform"
          style={{
            color: "var(--ev-text-tertiary)",
            transform: ouvert ? "rotate(180deg)" : undefined,
          }}
        />
      </button>

      {ouvert && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border shadow-lg"
          style={{ background: "var(--ev-card)", borderColor: "var(--ev-card-border)" }}
        >
          {partenaires.map((p) => {
            const courant = p.code === actif.code;
            return (
              <li key={p.code}>
                <button
                  type="button"
                  disabled={enCours || courant}
                  onClick={() =>
                    startTransition(async () => {
                      await onChoisir(p.code);
                      setOuvert(false);
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--ev-row-hover)] disabled:cursor-default"
                  style={courant ? { background: "var(--ev-nav-active-bg)" } : undefined}
                >
                  <Marque p={p} hauteur={18} />
                  <span className="flex-1" />
                  {courant && (
                    <Check className="size-3.5" style={{ color: "var(--pal-green-fg)" }} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
