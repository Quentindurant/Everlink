"use client";

import { useMemo, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { substituer, type VariablesMail } from "@/lib/domain/mail/substitution";
import type { ModeleMailLite } from "@/lib/repositories/mailRepository";
import { envoyerMailAction, setCreneauInterventionAction } from "./mailActions";

export interface EnvoiLigne {
  id: string;
  type: string;
  destinataire: string;
  objet: string;
  succes: boolean;
  erreur: string | null;
  creeLe: string;
  auteurEmail: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  PREVENANCE: "Prévenance",
  CONFIRMATION: "Confirmation RDV",
};

export function OngletMails({
  clientInfo,
  modeles,
  envois,
  numeroGc,
}: {
  clientInfo: {
    id: string;
    scenario: string | null;
    raisonSociale: string;
    filiale: string | null;
    adresse: string | null;
    contactNom: string | null;
    contactPrenom: string | null;
    contactEmail: string | null;
    dateIso: string | null;
    creneau: string | null;
  };
  modeles: ModeleMailLite[];
  envois: EnvoiLigne[];
  numeroGc: string;
}) {
  // Défaut: 1er template dont le scénario matche celui du client, sinon le 1er.
  const modeleParDefaut =
    modeles.find((m) => m.scenario === clientInfo.scenario)?.id ?? modeles[0]?.id ?? "";
  const [modeleId, setModeleId] = useState(modeleParDefaut);
  const [destinataire, setDestinataire] = useState(clientInfo.contactEmail ?? "");
  const [date, setDate] = useState(clientInfo.dateIso ?? "");
  const [creneau, setCreneau] = useState(clientInfo.creneau ?? "");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const modele = modeles.find((m) => m.id === modeleId) ?? null;

  const variables: Partial<VariablesMail> = useMemo(() => {
    const civ = [clientInfo.contactPrenom, clientInfo.contactNom].filter(Boolean).join(" ").trim();
    return {
      civilite_nom: civ || "Madame, Monsieur",
      nom_client: clientInfo.raisonSociale,
      filiale: clientInfo.filiale ?? "",
      adresse: clientInfo.adresse ?? "",
      date: date ? new Date(date).toLocaleDateString("fr-FR") : "",
      creneau,
      numero_gc: numeroGc,
    };
  }, [clientInfo, date, creneau, numeroGc]);

  const objetRempli = modele ? substituer(modele.objet, variables) : "";
  const corpsRempli = modele ? substituer(modele.corps, variables) : "";

  const envoyer = () => {
    if (!modele) return;
    setMessage(null);
    startTransition(async () => {
      // Persiste date/créneau saisis, puis envoie le contenu tel que prévisualisé.
      await setCreneauInterventionAction(clientInfo.id, date, creneau);
      const r = await envoyerMailAction(
        clientInfo.id,
        modele.type,
        destinataire,
        objetRempli,
        corpsRempli
      );
      setMessage(
        r.success
          ? { ok: true, texte: "Mail envoyé et étape avancée." }
          : { ok: false, texte: r.error ?? "Échec de l'envoi." }
      );
    });
  };

  if (modeles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Aucun modèle de mail. Créez-en dans Paramètres.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Paramètres de l'envoi */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Modèle</label>
            <select
              value={modeleId}
              onChange={(e) => setModeleId(e.target.value)}
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
            >
              {modeles.map((m) => (
                <option key={m.id} value={m.id}>
                  {TYPE_LABEL[m.type] ?? m.type} — {m.scenario}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Destinataire</label>
            <Input
              type="email"
              value={destinataire}
              onChange={(e) => setDestinataire(e.target.value)}
              placeholder="contact@client.fr"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Créneau</label>
              <Input value={creneau} onChange={(e) => setCreneau(e.target.value)} placeholder="9h-13h" />
            </div>
          </div>
          <Button onClick={envoyer} disabled={isPending || !destinataire.trim()}>
            <Send data-icon="inline-start" />
            {isPending ? "Envoi…" : "Envoyer le mail"}
          </Button>
          {message && (
            <span className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>
              {message.texte}
            </span>
          )}
        </div>

        {/* Prévisualisation */}
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Aperçu</div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
            {objetRempli || "—"}
          </div>
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted/20 px-3 py-2 text-[13px] whitespace-pre-wrap">
            {corpsRempli || "—"}
          </pre>
        </div>
      </div>

      {/* Historique */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <p className="border-b p-3 text-sm font-medium">Historique des envois</p>
        {envois.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun mail envoyé.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Date", "Type", "Destinataire", "Objet", "Statut", "Auteur"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {envois.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{e.creeLe}</TableCell>
                  <TableCell>{TYPE_LABEL[e.type] ?? e.type}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.destinataire}</TableCell>
                  <TableCell className="max-w-64 truncate" title={e.objet}>{e.objet}</TableCell>
                  <TableCell>
                    {e.succes ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Envoyé
                      </span>
                    ) : (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive" title={e.erreur ?? undefined}>
                        Échec
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{e.auteurEmail ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
