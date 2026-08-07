"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Pencil, Search, Trash2, Upload, Wifi, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConfigRouteurExtraite } from "@/lib/domain/routeur/mikrotik";
import type { ConfigRouteurLigne } from "@/lib/repositories/stockRepository";
import {
  importerConfigRouteurAction,
  modifierClientConfigRouteurAction,
  supprimerConfigRouteurAction,
} from "../actions";
import { VueUnyc } from "./VueUnyc";

// Import du .rsc + liste repliée des configs (une ligne par client, badges résumé) : on
// déplie celle qu'on recopie sur UNYC. Le client rattaché est modifiable, la suppression
// demande une confirmation — mauvais fichier = supprimer puis ré-importer.
export function ConfigRouteurStaging({
  configs,
  clients,
}: {
  configs: ConfigRouteurLigne[];
  clients: { id: string; raisonSociale: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const [editionId, setEditionId] = useState<string | null>(null);
  const [clientEdite, setClientEdite] = useState("");
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const idListe = "clients-config-routeur";

  const importer = (formData: FormData) => {
    setErreur(null);
    startTransition(async () => {
      const r = await importerConfigRouteurAction(formData);
      if (r.success) {
        formRef.current?.reset();
        router.refresh();
      } else setErreur(r.error ?? "Échec de l'import.");
    });
  };

  const basculer = (id: string) =>
    setOuverts((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const enregistrerClient = (id: string) => {
    startTransition(async () => {
      const r = await modifierClientConfigRouteurAction(id, clientEdite);
      if (r.success) {
        setEditionId(null);
        router.refresh();
      } else setErreur(r.error ?? "Échec de la modification.");
    });
  };

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter(
      (c) =>
        (c.clientNom ?? "").toLowerCase().includes(q) ||
        c.nomFichier.toLowerCase().includes(q)
    );
  }, [configs, recherche]);

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      {/* Import + recherche */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <form ref={formRef} action={importer} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="fichier"
            accept=".rsc,text/plain"
            required
            className="text-sm file:mr-3 file:rounded-[7px] file:border-0 file:bg-primary file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          <Input list={idListe} name="client" placeholder="client…" className="h-9 w-56 text-sm" />
          <Button type="submit" disabled={isPending}>
            <Upload data-icon="inline-start" />
            {isPending ? "Analyse…" : "Importer"}
          </Button>
        </form>
        {configs.length > 3 && (
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Filtrer par client…"
              className="h-9 w-52 pl-8 text-sm"
            />
          </div>
        )}
        {erreur && <span className="w-full text-sm text-destructive">{erreur}</span>}
      </div>

      {/* Liste repliée : une ligne par configuration, clic pour déplier la vue UNYC */}
      {filtrees.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {configs.length === 0 ? "Aucune configuration importée." : "Aucune configuration ne correspond au filtre."}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtrees.map((c) => {
            const d = c.donnees as ConfigRouteurExtraite;
            const ouvert = ouverts.has(c.id);
            const nbNat = d.nat.filter((n) => n.action === "dst-nat" && n.portsEntree).length;
            return (
              <div
                key={c.id}
                className="border-t first:border-t-0"
                style={{ borderColor: "var(--ev-card-border-light)" }}
              >
                <div
                  onClick={() => basculer(c.id)}
                  className={cn(
                    "flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2.5 transition-colors",
                    ouvert ? "bg-[var(--pal-violet-bg)]/40" : "hover:bg-[var(--ev-row-hover)]"
                  )}
                >
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform", !ouvert && "-rotate-90")}
                  />

                  {editionId === c.id ? (
                    <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                      <Input
                        list={idListe}
                        value={clientEdite}
                        onChange={(e) => setClientEdite(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && enregistrerClient(c.id)}
                        autoFocus
                        className="h-7 w-56 text-sm"
                      />
                      <button
                        onClick={() => enregistrerClient(c.id)}
                        disabled={isPending}
                        className="rounded-lg border p-1 text-[color:var(--pal-green-fg)] hover:bg-[var(--pal-green-bg)]"
                        title="Enregistrer"
                      >
                        <Check className="size-3" />
                      </button>
                      <button
                        onClick={() => setEditionId(null)}
                        className="rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
                        title="Annuler"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ) : (
                    <>
                      <span className="text-[13.5px] font-bold">
                        {c.clientNom ?? "— client non renseigné —"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditionId(c.id);
                          setClientEdite(c.clientNom ?? "");
                        }}
                        className="rounded-lg border p-1 text-muted-foreground hover:bg-[var(--ev-row-hover)]"
                        title="Modifier le client rattaché"
                      >
                        <Pencil className="size-3" />
                      </button>
                    </>
                  )}

                  {d.identite && (
                    <span className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]">
                      {d.identite}
                    </span>
                  )}
                  {d.wifi.length > 0 && (
                    <span className="ev-badge bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]">
                      <Wifi className="size-2.5" />
                      WiFi ×{d.wifi.length}
                    </span>
                  )}
                  <span
                    className={cn(
                      "ev-badge",
                      nbNat > 0 || d.dmz
                        ? "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]"
                        : "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
                    )}
                  >
                    {d.dmz
                      ? nbNat > 0
                        ? `DMZ + ${nbNat} NAT`
                        : "DMZ"
                      : nbNat > 0
                        ? `${nbNat} NAT`
                        : "aucun NAT"}
                  </span>

                  <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
                    {c.nomFichier} · {new Date(c.creeLe).toLocaleDateString("fr-FR")}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                    {confirmationId === c.id ? (
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            await supprimerConfigRouteurAction(c.id);
                            setConfirmationId(null);
                            router.refresh();
                          })
                        }
                        disabled={isPending}
                        className="rounded-lg border border-destructive bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive"
                        onMouseLeave={() => setConfirmationId(null)}
                      >
                        Supprimer ?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmationId(c.id)}
                        className="rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer cette configuration (puis ré-importer si mauvais fichier)"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </span>
                </div>

                {/* Sections calquées sur les écrans UNYC, champs copiables un par un. */}
                {ouvert && (
                  <div className="px-4 pb-3">
                    <VueUnyc d={d} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
