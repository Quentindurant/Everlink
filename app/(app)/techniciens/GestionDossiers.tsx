"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, PhoneOutgoing, Router, Search, Send, Sheet } from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { DossierAdv, TechnicienLigne } from "@/lib/repositories/technicienRepository";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { EtapeMigrationSelect } from "@/components/migration/EtapeMigrationSelect";
import { noterTentativeContactAction } from "@/app/(app)/clients/actions";
import { setCreneauInterventionAction } from "@/app/(app)/clients/[id]/mailActions";
import { marquerLienCommandeAction, marquerLienLivreAction } from "@/app/(app)/clients/[id]/lienActions";
import { pousserVersZohoAction } from "@/app/(app)/clients/[id]/zohoActions";
import { couleurStatutSuivi, STATUTS_SUIVI } from "@/lib/domain/zoho/suiviSheet";
import {
  affecterTechnicienAction,
  setRouteurClientReutiliseAction,
  updateSuiviAdvAction,
} from "./actions";

// Pastille au code couleur du TABLEAU SUIVI COMMANDES (mêmes teintes que le Sheet des ADV).
function SelectStatutSuivi({
  clientId,
  statut,
  onDone,
}: {
  clientId: string;
  statut: string | null;
  onDone: (fn: () => Promise<unknown>) => void;
}) {
  const couleur = statut ? couleurStatutSuivi(statut) : null;
  return (
    <select
      value={statut ?? ""}
      onChange={(e) => onDone(() => updateSuiviAdvAction(clientId, "statutSuivi", e.target.value))}
      className="cursor-pointer appearance-none rounded-full border border-transparent px-2.5 py-1 text-[11px] font-bold tracking-wide outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
      style={
        couleur
          ? {
              background: `color-mix(in oklab, ${couleur} 30%, white)`,
              color: `color-mix(in oklab, ${couleur} 62%, black)`,
            }
          : { color: "var(--ev-body-placeholder)" }
      }
    >
      <option value="">— statut —</option>
      {STATUTS_SUIVI.map((s) => (
        <option key={s.statut} value={s.statut}>
          {s.statut}
        </option>
      ))}
    </select>
  );
}

// Champ texte inline sauvegardé au blur (matériel reçu, n° chrono, infos facturation).
function ChampSuivi({
  clientId,
  champ,
  valeur,
  placeholder,
  largeur = "w-24",
  onDone,
}: {
  clientId: string;
  champ: "materielRecu" | "numeroChrono" | "infosFacturation";
  valeur: string | null;
  placeholder: string;
  largeur?: string;
  onDone: (fn: () => Promise<unknown>) => void;
}) {
  const [v, setV] = useState(valeur ?? "");
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== (valeur ?? "")) onDone(() => updateSuiviAdvAction(clientId, champ, v));
      }}
      className={cn(
        largeur,
        "rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] outline-none placeholder:text-muted-foreground/40 hover:border-input focus:border-ring"
      )}
    />
  );
}

function LigneDossier({
  d,
  etapes,
  techniciens,
}: {
  d: DossierAdv;
  etapes: EtapeMigrationLite[];
  techniciens: TechnicienLigne[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(d.dateIso ?? "");
  const [creneau, setCreneau] = useState(d.creneau ?? "");
  const [dateImp, setDateImp] = useState(d.dateImperativeIso ?? "");

  const agir = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const sauverPlanif = () => {
    if (date === (d.dateIso ?? "") && creneau === (d.creneau ?? "")) return;
    agir(() => setCreneauInterventionAction(d.clientId, date, creneau));
  };

  return (
    <TableRow className={cn(isPending && "opacity-50")}>
      {/* Client */}
      <TableCell className="font-medium whitespace-nowrap">
        <Link href={`/clients/${d.clientId}`} className="hover:underline">
          {d.raisonSociale}
        </Link>
        {d.departement && (
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{d.departement}</span>
        )}
      </TableCell>

      {/* Statut ADV (code couleur du Sheet) */}
      <TableCell>
        <SelectStatutSuivi clientId={d.clientId} statut={d.statutSuivi} onDone={agir} />
      </TableCell>

      {/* Impératif */}
      <TableCell>
        <input
          type="date"
          value={dateImp}
          onChange={(e) => setDateImp(e.target.value)}
          onBlur={() => {
            if (dateImp !== (d.dateImperativeIso ?? ""))
              agir(() => updateSuiviAdvAction(d.clientId, "dateImperative", dateImp));
          }}
          className={cn(
            "rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] outline-none hover:border-input focus:border-ring",
            dateImp && "font-bold text-[color:var(--pal-red-fg)]"
          )}
          title="Date impérative (IMPE)"
        />
      </TableCell>

      {/* Étape */}
      <TableCell>
        <EtapeMigrationSelect clientId={d.clientId} etapeCouranteId={d.etapeMigrationId} etapes={etapes} />
      </TableCell>

      {/* Contact */}
      <TableCell>
        <button
          onClick={() => agir(() => noterTentativeContactAction(d.clientId))}
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs hover:bg-muted"
          title={d.dernierContactLe ? `dernière le ${d.dernierContactLe}` : "noter une tentative"}
        >
          <PhoneOutgoing className="size-3" />
          <span className={cn("tabular-nums", d.nbTentativesContact >= 3 && "font-bold text-destructive")}>
            {d.nbTentativesContact}
          </span>
        </button>
      </TableCell>

      {/* Date + créneau */}
      <TableCell>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={sauverPlanif}
            className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] outline-none hover:border-input focus:border-ring"
          />
          <input
            value={creneau}
            placeholder="9h-13h"
            onChange={(e) => setCreneau(e.target.value)}
            onBlur={sauverPlanif}
            className="w-16 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] outline-none placeholder:text-muted-foreground/50 hover:border-input focus:border-ring"
          />
        </div>
      </TableCell>

      {/* Technicien */}
      <TableCell>
        <select
          value={d.technicienId ?? ""}
          onChange={(e) => agir(() => affecterTechnicienAction(d.clientId, e.target.value))}
          className="max-w-36 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] outline-none hover:border-input focus:border-ring"
        >
          <option value="">—</option>
          {techniciens.map((t) => (
            <option key={t.id} value={t.id}>{t.nom}</option>
          ))}
        </select>
      </TableCell>

      {/* Lien */}
      <TableCell>
        {!d.avecLien ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : d.lienLivre ? (
          <span className="rounded-lg bg-[var(--pal-green-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--pal-green-fg)]">
            Livré
          </span>
        ) : d.lienCommande ? (
          <button
            onClick={() => agir(() => marquerLienLivreAction(d.clientId))}
            className="rounded-lg bg-[var(--pal-blue-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--pal-blue-fg)] hover:bg-[var(--pal-blue-bg)]"
            title="Cliquer pour marquer livré"
          >
            Commandé → livré ?
          </button>
        ) : (
          <button
            onClick={() => agir(() => marquerLienCommandeAction(d.clientId))}
            className="rounded-lg border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            title="Cliquer pour marquer commandé"
          >
            Commander
          </button>
        )}
      </TableCell>

      {/* Mails */}
      <TableCell>
        <Link
          href={`/clients/${d.clientId}?onglet=Mails`}
          className="inline-flex items-center gap-1.5 text-xs hover:underline"
          title="Ouvrir l'envoi de mails"
        >
          <Mail className="size-3 text-muted-foreground" />
          <span className={cn("rounded px-1", d.mailPrevenanceLe ? "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]" : "bg-muted text-muted-foreground")} title={d.mailPrevenanceLe ? `prévenance le ${d.mailPrevenanceLe}` : "prévenance non envoyée"}>
            P
          </span>
          <span className={cn("rounded px-1", d.mailConfirmationLe ? "bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]" : "bg-muted text-muted-foreground")} title={d.mailConfirmationLe ? `confirmation le ${d.mailConfirmationLe}` : "confirmation non envoyée"}>
            C
          </span>
        </Link>
      </TableCell>

      {/* Zoho */}
      <TableCell>
        <button
          onClick={() => agir(() => pousserVersZohoAction(d.clientId))}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] hover:bg-muted",
            d.zohoPousseLe ? "text-[color:var(--pal-green-fg)]" : "text-muted-foreground"
          )}
          title={d.zohoPousseLe ? `déjà poussé le ${d.zohoPousseLe} — re-cliquer ajoute une nouvelle ligne` : "ajouter au tableau Zoho"}
        >
          {d.zohoPousseLe ? <Sheet className="size-3" /> : <Send className="size-3" />}
          {d.zohoPousseLe ? "poussé" : "pousser"}
        </button>
      </TableCell>

      {/* Matériel reçu / N° Chrono / Infos facturation */}
      <TableCell>
        <ChampSuivi clientId={d.clientId} champ="materielRecu" valeur={d.materielRecu} placeholder="matériel…" largeur="w-24" onDone={agir} />
      </TableCell>
      <TableCell>
        <ChampSuivi clientId={d.clientId} champ="numeroChrono" valeur={d.numeroChrono} placeholder="n° chrono…" largeur="w-32" onDone={agir} />
      </TableCell>
      <TableCell>
        <ChampSuivi clientId={d.clientId} champ="infosFacturation" valeur={d.infosFacturation} placeholder="factu…" largeur="w-24" onDone={agir} />
      </TableCell>

      {/* Routeur client réutilisé (reset sur place, pas d'envoi depuis le stock) */}
      <TableCell>
        <button
          onClick={() => agir(() => setRouteurClientReutiliseAction(d.clientId, !d.routeurClientReutilise))}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px]",
            d.routeurClientReutilise
              ? "border-transparent bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]"
              : "text-muted-foreground hover:bg-muted"
          )}
          title="Réutilisation du routeur déjà présent chez le client (reset sur place)"
        >
          <Router className="size-3" />
          {d.routeurClientReutilise ? "réutilisé" : "—"}
        </button>
      </TableCell>
    </TableRow>
  );
}

export function GestionDossiers({
  dossiers,
  etapes,
  techniciens,
}: {
  dossiers: DossierAdv[];
  etapes: EtapeMigrationLite[];
  techniciens: TechnicienLigne[];
}) {
  const [recherche, setRecherche] = useState("");
  const techsActifs = techniciens.filter((t) => t.actif);
  const visibles = dossiers.filter((d) =>
    d.raisonSociale.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Filtrer les dossiers…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="hover:bg-transparent">
              {["Client", "Statut ADV", "Impératif", "Étape", "Contact", "Intervention", "Technicien", "Lien", "Mails", "Zoho", "Matériel reçu", "N° Chrono", "Facturation", "Routeur"].map((h) => (
                <TableHead key={h} className="h-9 whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="py-8 text-center text-sm text-muted-foreground">
                  Aucun dossier.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((d) => (
                <LigneDossier key={d.clientId} d={d} etapes={etapes} techniciens={techsActifs} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Tout est éditable ici : statut ADV (code couleur du tableau de suivi), date impérative,
        étape, tentative de contact (+1 au clic), date/créneau, technicien, lien (clic = commandé
        puis livré), P/C = mails prévenance/confirmation, Zoho = ajouter la ligne au tableau,
        matériel reçu, n° Chrono, infos facturation.
      </p>
    </div>
  );
}
