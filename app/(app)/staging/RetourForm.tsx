"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="flex flex-wrap items-center gap-2 p-4">
      <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="type / modèle" className="h-9 w-44 text-sm" />
      <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="n° série" className="h-9 w-48 font-mono text-sm" />
      <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="client" className="h-9 w-44 text-sm" />
      <Button onClick={enregistrer} disabled={isPending || !serie.trim()}>
        {isPending ? "…" : "Enregistrer le retour"}
      </Button>
      {erreur && <span className="text-sm text-destructive">{erreur}</span>}
    </div>
  );
}
