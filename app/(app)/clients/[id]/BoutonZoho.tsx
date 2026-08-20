"use client";

import { useState, useTransition } from "react";
import { Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pousserVersZohoAction } from "./zohoActions";

export function BoutonZoho({
  clientId,
  dejaPousseLe,
}: {
  clientId: string;
  dejaPousseLe: string | null;
}) {
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pousse, setPousse] = useState(dejaPousseLe);
  const [isPending, startTransition] = useTransition();

  const pousser = () => {
    if (pousse && !window.confirm("Une ligne a déjà été ajoutée au tableau de suivi pour ce client. En ajouter une autre ?")) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const r = await pousserVersZohoAction(clientId);
      if (r.success) {
        setMessage({ ok: true, texte: "Ligne ajoutée au tableau de suivi." });
        setPousse(new Date().toLocaleDateString("fr-FR"));
      } else {
        setMessage({ ok: false, texte: r.error ?? "Échec." });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" disabled={isPending} onClick={pousser}>
        <Sheet data-icon="inline-start" />
        {isPending ? "Envoi…" : "Ajouter au tableau de suivi"}
      </Button>
      {pousse && (
        <span className="text-xs text-muted-foreground">déjà poussé le {pousse}</span>
      )}
      {message && (
        <span className={message.ok ? "text-sm text-[color:var(--pal-green-fg)]" : "text-sm text-destructive"}>
          {message.texte}
        </span>
      )}
    </div>
  );
}
