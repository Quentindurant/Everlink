"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef } from "react";

export function ProvisionningFiltresBar({
  lots,
  clients,
  valeursStatutBascule,
}: {
  lots: { id: string; nom: string }[];
  clients: { id: string; raisonSociale: string }[];
  valeursStatutBascule: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  const setParamDebounced = (key: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam(key, value), 300);
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
      <input
        placeholder="Rechercher (numéro, MAC, utilisateur, raison sociale)"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => setParamDebounced("q", e.target.value)}
      />
      <select
        defaultValue={searchParams.get("lot") ?? ""}
        onChange={(e) => setParam("lot", e.target.value)}
      >
        <option value="">Lot (tous)</option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.nom}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("client") ?? ""}
        onChange={(e) => setParam("client", e.target.value)}
      >
        <option value="">Client (tous)</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.raisonSociale}
          </option>
        ))}
      </select>
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
        {valeursStatutBascule.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
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
