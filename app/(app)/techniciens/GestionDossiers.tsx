"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, PhoneOutgoing, Router, Search, Send, Sheet } from "lucide-react";
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
import {
  noterTentativeContactAction,
  retirerTentativeContactAction,
} from "@/app/(app)/clients/actions";
import { setCreneauInterventionAction } from "@/app/(app)/clients/[id]/mailActions";
import { marquerLienCommandeAction, marquerLienLivreAction } from "@/app/(app)/clients/[id]/lienActions";
import { pousserVersZohoAction } from "@/app/(app)/clients/[id]/zohoActions";
import { couleurStatutSuivi, STATUTS_SUIVI } from "@/lib/domain/zoho/suiviSheet";
import { SuiviColisBadge } from "@/components/SuiviColisBadge";
import { useEtatMemorise } from "@/components/useEtatMemorise";
import {
  affecterTechnicienParNomAction,
  basculerMailManuelAction,
  setColisSuiviAction,
  setRouteurClientReutiliseAction,
  updateSuiviAdvAction,
} from "./actions";

// Colis client : le badge d'état + un champ scannable pour saisir/coller le N° de suivi.
function ColisCell({
  d,
  onDone,
}: {
  d: DossierAdv;
  onDone: (fn: () => Promise<unknown>) => void;
}) {
  const [saisie, setSaisie] = useState(false);
  const [num, setNum] = useState(d.colisNumeroSuivi ?? "");
  if (!saisie && d.colisNumeroSuivi) {
    return (
      <button onClick={() => setSaisie(true)} title="Modifier le numéro de suivi" className="text-left">
        <SuiviColisBadge
          statut={d.colisSuiviStatut}
          libelle={d.colisSuiviLibelle}
          numeroSuivi={d.colisNumeroSuivi}
          transporteur={d.colisTransporteur}
        />
      </button>
    );
  }
  if (!saisie) {
    return (
      <button
        onClick={() => setSaisie(true)}
        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
      >
        + suivi colis
      </button>
    );
  }
  return (
    <input
      value={num}
      autoFocus
      placeholder="scan N° suivi…"
      onChange={(e) => setNum(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setSaisie(false);
          onDone(() => setColisSuiviAction(d.clientId, num));
        }
        if (e.key === "Escape") setSaisie(false);
      }}
      onBlur={() => {
        setSaisie(false);
        if (num !== (d.colisNumeroSuivi ?? "")) onDone(() => setColisSuiviAction(d.clientId, num));
      }}
      className="w-32 rounded-md border border-input bg-transparent px-1.5 py-0.5 font-mono text-[12px] outline-none focus:border-ring"
    />
  );
}

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
      className="cursor-pointer appearance-none rounded-full border px-3 py-1 text-[11.5px] font-bold tracking-wide outline-none focus:ring-2 focus:ring-ring/40"
      style={
        couleur
          ? {
              background: `color-mix(in oklab, ${couleur} 38%, white)`,
              color: `color-mix(in oklab, ${couleur} 65%, black)`,
              borderColor: `color-mix(in oklab, ${couleur} 55%, white)`,
            }
          : { color: "var(--ev-body-placeholder)", borderColor: "var(--ev-card-border)" }
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
  champ: "materielRecu" | "numeroChrono" | "infosFacturation" | "commentaire";
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

// Technicien du dossier : champ libre avec autocomplétion sur l'annuaire. Un nom absent de
// l'annuaire (fréquent : les ADV reprennent ceux du Zoho Sheet) crée le technicien plutôt
// que de rester introuvable. Une liste de 127 noms ne se parcourt pas dans un menu déroulant.
function ChampTechnicien({
  clientId,
  nom,
  techniciens,
  idListe,
  onDone,
}: {
  clientId: string;
  nom: string | null;
  techniciens: TechnicienLigne[];
  idListe: string;
  onDone: (fn: () => Promise<unknown>) => void;
}) {
  const [valeur, setValeur] = useState(nom ?? "");
  const connu = techniciens.some((t) => t.nom.toLowerCase() === valeur.trim().toLowerCase());
  return (
    <input
      list={idListe}
      value={valeur}
      placeholder="technicien…"
      onChange={(e) => setValeur(e.target.value)}
      onBlur={() => {
        if (valeur.trim() !== (nom ?? "")) onDone(() => affecterTechnicienParNomAction(clientId, valeur));
      }}
      title={
        valeur.trim() && !connu
          ? "Ce technicien n'est pas dans l'annuaire : il sera créé à la validation"
          : "Technicien affecté"
      }
      className={cn(
        "w-36 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[12.5px] outline-none placeholder:text-muted-foreground/40 hover:border-input focus:border-ring",
        valeur.trim() && !connu && "text-[color:var(--pal-amber-fg)]"
      )}
    />
  );
}

// Prévenance / Confirmation. Vert plein = mail parti de l'app (fait établi, non décochable).
// Vert clair = coché à la main parce que l'ADV a prévenu autrement. Gris = rien.
function PastilleMail({
  lettre,
  envoyeLe,
  manuelLe,
  onBasculer,
}: {
  lettre: "P" | "R" | "C";
  envoyeLe: string | null;
  manuelLe: string | null;
  onBasculer: () => void;
}) {
  const libelle =
    lettre === "P" ? "prévenance" : lettre === "R" ? "relance" : "confirmation";
  if (envoyeLe) {
    return (
      <span
        className="rounded px-1 text-xs font-semibold bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]"
        title={`${libelle} envoyée depuis l'app le ${envoyeLe}`}
      >
        {lettre}
      </span>
    );
  }
  return (
    <button
      onClick={onBasculer}
      className={cn(
        "rounded px-1 text-xs transition-colors hover:cursor-pointer",
        manuelLe
          ? "bg-[var(--pal-green-bg)]/50 font-semibold text-[color:var(--pal-green-fg)]"
          : "bg-muted text-muted-foreground hover:bg-[var(--ev-row-hover)]"
      )}
      title={
        manuelLe
          ? `${libelle} faite hors application le ${manuelLe} — cliquer pour décocher`
          : `${libelle} non envoyée — cliquer si elle a été faite hors application`
      }
    >
      {lettre}
    </button>
  );
}

function LigneDossier({
  d,
  etapes,
  techniciens,
  idListeTechs,
}: {
  d: DossierAdv;
  etapes: EtapeMigrationLite[];
  techniciens: TechnicienLigne[];
  idListeTechs: string;
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

  // La ligne entière prend une teinte très légère de la couleur du statut ADV, comme le code
  // couleur du tableau de suivi : l'état du dossier se lit d'un balayage, sans lire le texte.
  const couleurLigne = d.statutSuivi ? couleurStatutSuivi(d.statutSuivi) : null;
  // Intervention imminente (aujourd'hui ou demain) : la date passe en bleu gras.
  const imminent =
    !!d.dateIso &&
    new Date(d.dateIso).getTime() - new Date(new Date().toDateString()).getTime() <
      2 * 86400000;

  return (
    <TableRow
      className={cn(isPending && "opacity-50")}
      style={
        couleurLigne
          ? { background: `color-mix(in oklab, ${couleurLigne} 7%, white)` }
          : undefined
      }
    >
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

      {/* Contact : +1 au clic, −1 pour corriger un double clic */}
      <TableCell>
        <span className="inline-flex items-center gap-0.5">
          <button
            onClick={() => agir(() => noterTentativeContactAction(d.clientId))}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:cursor-pointer",
              d.nbTentativesContact >= 3
                ? "border-transparent bg-[var(--pal-red-bg)] font-bold text-[color:var(--pal-red-fg)]"
                : d.nbTentativesContact > 0
                  ? "border-transparent bg-[var(--pal-amber-bg)] font-semibold text-[color:var(--pal-amber-fg)]"
                  : "text-muted-foreground hover:bg-muted"
            )}
            title={d.dernierContactLe ? `dernière le ${d.dernierContactLe}` : "noter une tentative"}
          >
            <PhoneOutgoing className="size-3" />
            <span className="tabular-nums">{d.nbTentativesContact}</span>
          </button>
          {d.nbTentativesContact > 0 && (
            <button
              onClick={() => agir(() => retirerTentativeContactAction(d.clientId))}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Retirer une tentative comptée par erreur"
            >
              <Minus className="size-3" />
            </button>
          )}
        </span>
      </TableCell>

      {/* Date + créneau */}
      <TableCell>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={sauverPlanif}
            className={cn(
              "rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] outline-none hover:border-input focus:border-ring",
              imminent && "font-bold text-[color:var(--ev-accent-text)]"
            )}
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
        <ChampTechnicien
          clientId={d.clientId}
          nom={d.technicienNom}
          techniciens={techniciens}
          idListe={idListeTechs}
          onDone={agir}
        />
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
        <span className="inline-flex items-center gap-1.5">
          <PastilleMail
            lettre="P"
            envoyeLe={d.mailPrevenanceLe}
            manuelLe={d.mailPrevenanceManuelLe}
            onBasculer={() => agir(() => basculerMailManuelAction(d.clientId, "PREVENANCE"))}
          />
          <PastilleMail
            lettre="R"
            envoyeLe={d.mailRelanceLe}
            manuelLe={d.mailRelanceManuelLe}
            onBasculer={() => agir(() => basculerMailManuelAction(d.clientId, "RELANCE"))}
          />
          <PastilleMail
            lettre="C"
            envoyeLe={d.mailConfirmationLe}
            manuelLe={d.mailConfirmationManuelLe}
            onBasculer={() => agir(() => basculerMailManuelAction(d.clientId, "CONFIRMATION"))}
          />
          <Link
            href={`/clients/${d.clientId}?onglet=Mails`}
            className="text-[10.5px] text-muted-foreground hover:underline"
            title="Ouvrir la fiche client pour envoyer le mail"
          >
            envoyer
          </Link>
        </span>
      </TableCell>

      {/* Zoho */}
      <TableCell>
        <button
          onClick={() => agir(() => pousserVersZohoAction(d.clientId))}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] hover:bg-muted",
            d.zohoPousseLe ? "text-[color:var(--pal-green-fg)]" : "text-muted-foreground"
          )}
          title={d.zohoPousseLe ? `déjà poussé le ${d.zohoPousseLe} — re-cliquer ajoute une nouvelle ligne` : "ajouter au tableau de suivi"}
        >
          {d.zohoPousseLe ? <Sheet className="size-3" /> : <Send className="size-3" />}
          {d.zohoPousseLe ? "poussé" : "pousser"}
        </button>
      </TableCell>

      {/* Colis (suivi Chronopost) */}
      <TableCell>
        <ColisCell d={d} onDone={agir} />
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

      {/* Commentaire libre du dossier (partagé avec la fiche client) */}
      <TableCell title={d.commentaire ?? undefined}>
        <ChampSuivi clientId={d.clientId} champ="commentaire" valeur={d.commentaire} placeholder="commentaire…" largeur="w-44" onDone={agir} />
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
  // Les ADV pilotent lot par lot : un lot ouvert à la fois garde le tableau lisible.
  // Mémorisé dans l'onglet : un aller-retour vers une fiche client ne referme rien.
  const [lotOuvert, setLotOuvert] = useEtatMemorise<string | null>("adv:lot-ouvert", null);
  const techsActifs = techniciens.filter((t) => t.actif);
  const idListeTechs = "annuaire-techniciens";
  const visibles = dossiers.filter((d) =>
    d.raisonSociale.toLowerCase().includes(recherche.toLowerCase())
  );

  // Regroupement par lot, dans l'ordre des noms de lot ; les dossiers sans lot en dernier.
  const parLot = new Map<string, DossierAdv[]>();
  for (const d of visibles) {
    const cle = d.lotNom ?? "Sans lot";
    const liste = parLot.get(cle);
    if (liste) liste.push(d);
    else parLot.set(cle, [d]);
  }
  const lots = [...parLot.entries()].sort(([a], [b]) =>
    a === "Sans lot" ? 1 : b === "Sans lot" ? -1 : a.localeCompare(b, "fr", { numeric: true })
  );
  // Une recherche traverse les lots : on déplie tout pour ne rien cacher.
  const toutDeplie = recherche.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <datalist id={idListeTechs}>
        {techsActifs.map((t) => (
          <option key={t.id} value={t.nom} />
        ))}
      </datalist>
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
              {["Client", "Statut ADV", "Impératif", "Étape", "Contact", "Intervention", "Technicien", "Lien", "Mails", "Suivi", "Colis", "Matériel reçu", "N° Chrono", "Facturation", "Commentaire", "Routeur"].map((h) => (
                <TableHead key={h} className="h-9 whitespace-nowrap">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="py-8 text-center text-sm text-muted-foreground">
                  Aucun dossier.
                </TableCell>
              </TableRow>
            ) : (
              lots.map(([lot, lignes]) => {
                const ouvert = toutDeplie || lotOuvert === lot;
                const aPlanifier = lignes.filter((l) => !l.dateIso).length;
                return (
                  <Fragment key={lot}>
                    <TableRow
                      className="cursor-pointer bg-[var(--ev-thead)] hover:bg-[var(--ev-row-hover)]"
                      onClick={() => setLotOuvert(ouvert ? null : lot)}
                    >
                      <TableCell colSpan={16} className="py-2">
                        <span className="flex items-center gap-2.5">
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              !ouvert && "-rotate-90"
                            )}
                          />
                          <span className="text-[13.5px] font-bold">{lot}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {lignes.length} dossier{lignes.length > 1 ? "s" : ""}
                          </span>
                          {aPlanifier > 0 && (
                            <span className="ev-badge bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
                              {aPlanifier} sans date
                            </span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                    {ouvert &&
                      lignes.map((d) => (
                        <LigneDossier
                          key={d.clientId}
                          d={d}
                          etapes={etapes}
                          techniciens={techsActifs}
                          idListeTechs={idListeTechs}
                        />
                      ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
