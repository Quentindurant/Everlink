"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ProvisionningFiltresBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
      <input
        placeholder="Rechercher (numéro, MAC, utilisateur, raison sociale)"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => setParam("q", e.target.value)}
      />
      <select
        defaultValue={searchParams.get("hebergeur") ?? ""}
        onChange={(e) => setParam("hebergeur", e.target.value)}
      >
        <option value="">Hébergeur (tous)</option>
        <option value="SEWAN">SEWAN</option>
        <option value="UNYC">UNYC</option>
      </select>
      <select
        defaultValue={searchParams.get("statut") ?? ""}
        onChange={(e) => setParam("statut", e.target.value)}
      >
        <option value="">Statut bascule (tous)</option>
        <option value="À faire">À faire</option>
        <option value="Fait">Fait</option>
      </select>
      <label>
        <input
          type="checkbox"
          defaultChecked={searchParams.get("anomalie") === "1"}
          onChange={(e) => setParam("anomalie", e.target.checked ? "1" : "")}
        />
        Anomalies seulement
      </label>
      <label>
        <input
          type="checkbox"
          defaultChecked={searchParams.get("eligible") === "1"}
          onChange={(e) => setParam("eligible", e.target.checked ? "1" : "")}
        />
        Éligibles export seulement
      </label>
    </div>
  );
}
