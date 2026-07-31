"use client";

import { useState, useTransition } from "react";
import { PhoneOutgoing, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EtapeMigrationStepper } from "@/components/migration/EtapeMigrationStepper";
import { EtapeMigrationSelect } from "@/components/migration/EtapeMigrationSelect";
import { doitSuggererBloque, type EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import {
  noterTentativeContactAction,
  passerBloqueAction,
  updateReferenceClientAction,
} from "../actions";

export function FicheMigrationHeader({
  clientId,
  etapes,
  etapeCouranteId,
  nbTentativesContact,
  dernierContactLe,
  referenceClient,
}: {
  clientId: string;
  etapes: EtapeMigrationLite[];
  etapeCouranteId: string | null;
  nbTentativesContact: number;
  dernierContactLe: string | null;
  referenceClient: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [reference, setReference] = useState(referenceClient ?? "");
  const courante = etapes.find((e) => e.id === etapeCouranteId) ?? null;
  const suggererBloque = doitSuggererBloque(nbTentativesContact, courante);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EtapeMigrationStepper etapes={etapes} etapeCouranteId={etapeCouranteId} />
        <EtapeMigrationSelect
          clientId={clientId}
          etapeCouranteId={etapeCouranteId}
          etapes={etapes}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await noterTentativeContactAction(clientId);
            })
          }
        >
          <PhoneOutgoing data-icon="inline-start" />
          Noter une tentative de contact
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {nbTentativesContact} tentative{nbTentativesContact > 1 ? "s" : ""}
          {dernierContactLe && ` · dernière le ${dernierContactLe}`}
        </span>

        {suggererBloque && (
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm text-destructive">
            <span>3 tentatives sans succès.</span>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() =>
                startTransition(async () => {
                  await passerBloqueAction(clientId);
                })
              }
            >
              <Ban data-icon="inline-start" />
              Passer en Bloqué
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <label className="text-xs font-medium text-muted-foreground">Référence client</label>
        <input
          value={reference}
          placeholder="EV VTO0907 : XXXXX"
          onChange={(e) => setReference(e.target.value)}
          onBlur={() => {
            if (reference !== (referenceClient ?? ""))
              startTransition(async () => {
                await updateReferenceClientAction(clientId, reference);
              });
          }}
          className="w-64 rounded-md border border-input bg-transparent px-2 py-1 font-mono text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      </div>
    </div>
  );
}
