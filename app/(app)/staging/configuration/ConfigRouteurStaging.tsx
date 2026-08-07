"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConfigRouteurExtraite } from "@/lib/domain/routeur/mikrotik";
import type { ConfigRouteurLigne } from "@/lib/repositories/stockRepository";
import { importerConfigRouteurAction, supprimerConfigRouteurAction } from "../actions";
import { VueUnyc } from "./VueUnyc";

// Import du .rsc + affichage par client des infos à reproduire côté UNYC.
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

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      {/* Import */}
      <form ref={formRef} action={importer} className="flex flex-wrap items-center gap-2 px-4 py-3">
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
        {erreur && <span className="text-sm text-destructive">{erreur}</span>}
      </form>

      {/* Configurations importées */}
      {configs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune configuration importée.
        </p>
      ) : (
        <div className="flex flex-col">
          {configs.map((c) => {
            const d = c.donnees as ConfigRouteurExtraite;
            return (
              <div
                key={c.id}
                className="border-t px-4 py-3 first:border-t-0"
                style={{ borderColor: "var(--ev-card-border-light)" }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold">{c.clientNom ?? "— client non renseigné —"}</span>
                  {d.identite && (
                    <span className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]">
                      {d.identite}
                    </span>
                  )}
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {c.nomFichier} · {new Date(c.creeLe).toLocaleDateString("fr-FR")}
                  </span>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await supprimerConfigRouteurAction(c.id);
                        router.refresh();
                      })
                    }
                    className="ml-auto rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer cette configuration"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>

                {/* Sections calquées sur les écrans UNYC, champs copiables un par un. */}
                <VueUnyc d={d} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
