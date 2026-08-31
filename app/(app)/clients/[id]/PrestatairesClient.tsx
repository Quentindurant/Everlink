"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopiePuce } from "@/components/CopiePuce";
import type { PrestataireLigne } from "@/lib/repositories/prestatairesRepository";
import {
  LIBELLE_PRESTATAIRE,
  niveauPrestataire,
  STATUTS_PRESTATAIRE,
  type StatutPrestataire,
} from "@/lib/domain/prestataires/statuts";
import {
  ajouterPrestataireAction,
  setContactPrestataireAction,
  supprimerPrestataireAction,
} from "./prestataireActions";

const CLASSES_NIVEAU = {
  ok: "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
  attente: "bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
  alerte: "bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]",
} as const;

// Prestataires externes du client : l'ADV les saisit, le technicien indique s'il a pu les
// joindre. Un prestataire injoignable à l'approche de l'intervention alerte le chef de projet.
export function PrestatairesClient({
  clientId,
  prestataires,
}: {
  clientId: string;
  prestataires: PrestataireLigne[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState({
    metier: "",
    societe: "",
    contactNom: "",
    telephone: "",
    email: "",
    commentaire: "",
  });

  const ajouter = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await ajouterPrestataireAction(clientId, form);
      if (r.success) {
        setForm({ metier: "", societe: "", contactNom: "", telephone: "", email: "", commentaire: "" });
        setOuvert(false);
        router.refresh();
      } else setErreur(r.error ?? "Échec de l'ajout.");
    });
  };

  const agir = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 p-4">
      {prestataires.length === 0 && !ouvert && (
        <p className="text-[12.5px] text-muted-foreground">
          Aucun prestataire externe. Ajoutez ceux dont les équipements sont branchés sur l&apos;accès
          internet (alarme, vidéosurveillance, contrôle d&apos;accès, TPE…) : le technicien devra les
          appeler avant l&apos;intervention.
        </p>
      )}

      {prestataires.map((p) => {
        const niveau = niveauPrestataire(p.statutContact);
        return (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3"
            style={{ borderColor: "var(--ev-card-border)" }}
          >
            <div className="min-w-[190px]">
              <div className="text-[13px] font-bold">{p.societe}</div>
              <div className="text-[11.5px] text-muted-foreground">{p.metier}</div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {p.contactNom && <span className="text-[12px]">{p.contactNom}</span>}
              {p.telephone && <CopiePuce valeur={p.telephone} titre="Téléphone du prestataire" />}
              {p.email && <CopiePuce valeur={p.email} titre="Email du prestataire" />}
            </div>

            {p.commentaire && (
              <span className="max-w-64 truncate text-[11.5px] text-muted-foreground" title={p.commentaire}>
                {p.commentaire}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {p.contacteLeIso && (
                <span className="text-[10.5px] text-muted-foreground">
                  {new Date(p.contacteLeIso).toLocaleDateString("fr-FR")}
                  {p.contactePar ? ` · ${p.contactePar.split("@")[0]}` : ""}
                </span>
              )}
              <select
                value={p.statutContact}
                disabled={isPending}
                onChange={(e) =>
                  agir(() =>
                    setContactPrestataireAction(p.id, e.target.value as StatutPrestataire)
                  )
                }
                title="Le technicien indique s'il a pu joindre ce prestataire"
                className={cn(
                  "cursor-pointer appearance-none rounded-full border border-transparent px-2.5 py-1 text-[11.5px] font-semibold outline-none focus:border-ring disabled:opacity-50",
                  CLASSES_NIVEAU[niveau]
                )}
              >
                {STATUTS_PRESTATAIRE.map((s) => (
                  <option key={s} value={s}>
                    {LIBELLE_PRESTATAIRE[s]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => agir(() => supprimerPrestataireAction(p.id))}
                className="rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Supprimer ce prestataire"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        );
      })}

      {ouvert ? (
        <div
          className="flex flex-col gap-2 rounded-lg border p-3"
          style={{ borderColor: "var(--ev-card-border)" }}
        >
          <div className="flex flex-wrap gap-2">
            <Input
              value={form.metier}
              onChange={(e) => setForm({ ...form, metier: e.target.value })}
              placeholder="Métier (Alarme, TPE…)"
              className="h-8 w-44 text-sm"
              autoFocus
            />
            <Input
              value={form.societe}
              onChange={(e) => setForm({ ...form, societe: e.target.value })}
              placeholder="Société"
              className="h-8 w-52 text-sm"
            />
            <Input
              value={form.contactNom}
              onChange={(e) => setForm({ ...form, contactNom: e.target.value })}
              placeholder="Contact"
              className="h-8 w-40 text-sm"
            />
            <Input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              placeholder="Téléphone"
              className="h-8 w-36 text-sm"
            />
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="h-8 w-52 text-sm"
            />
          </div>
          <Input
            value={form.commentaire}
            onChange={(e) => setForm({ ...form, commentaire: e.target.value })}
            placeholder="Commentaire (ce qu'il gère, contraintes d'accès…)"
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={ajouter} disabled={isPending}>
              Ajouter
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
            {erreur && <span className="text-[11.5px] text-destructive">{erreur}</span>}
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setOuvert(true)}>
          <Plus data-icon="inline-start" />
          Ajouter un prestataire
        </Button>
      )}
    </div>
  );
}
