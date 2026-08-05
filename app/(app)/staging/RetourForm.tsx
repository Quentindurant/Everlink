"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ajouterRetourAction } from "./actions";

// Routeur récupéré chez le client le jour de l'installation (origine CLIENT, statut RETOUR).
export function RetourForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("");
  const [serie, setSerie] = useState("");
  const [client, setClient] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = () => {
    setErreur(null);
    startTransition(async () => {
      const r = await ajouterRetourAction(type, serie, client);
      if (r.success) {
        setType("");
        setSerie("");
        setClient("");
        router.refresh();
      } else setErreur(r.error ?? "Échec.");
    });
  };

  return (
    <div
      className="flex flex-wrap items-end gap-2 rounded-[10px] border bg-white p-3"
      style={{ borderColor: "var(--ev-card-border)" }}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Undo2 className="size-4" />
        Routeur récupéré chez le client
      </div>
      <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="type / modèle" className="h-8 w-40 text-sm" />
      <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="n° série" className="h-8 w-44 text-sm" />
      <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="client" className="h-8 w-40 text-sm" />
      <Button size="sm" onClick={enregistrer} disabled={isPending || !serie.trim()}>
        {isPending ? "…" : "Enregistrer le retour"}
      </Button>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
    </div>
  );
}
