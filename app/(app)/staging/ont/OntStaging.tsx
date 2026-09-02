"use client";

import { useState, useTransition } from "react";
import { Boxes, Check, PackageCheck, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import type { LotOnt, OntLigne } from "@/lib/repositories/ontRepository";
import { SectionStaging } from "../SectionStaging";
import { FriseColis } from "@/components/FriseColis";
import { BarreRecherche, correspond } from "@/components/BarreRecherche";
import { useRafraichissementAuto } from "@/components/useRafraichissementAuto";
import {
  cloreLotAction,
  cocherReceptionOntAction,
  creerOntAction,
  modifierOntAction,
  retirerDuLotAction,
  supprimerOntAction,
  verserDansLotAction,
} from "../actions";

export interface ClientOption {
  id: string;
  raisonSociale: string;
}

const CHAMP = "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:border-ring";
const BOUTON_ICONE =
  "grid size-7 shrink-0 place-items-center rounded-md border text-muted-foreground hover:bg-[var(--ev-row-hover)] disabled:opacity-40";

type Action = Promise<{ success: boolean; error?: string }>;

export function OntStaging({
  annonces,
  lotOuvert,
  lotsPartis,
  clients,
}: {
  annonces: OntLigne[];
  lotOuvert: LotOnt | null;
  lotsPartis: LotOnt[];
  clients: ClientOption[];
}) {
  useRafraichissementAuto();
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  const visibles = annonces.filter((o) => correspond([o.numeroSerie, o.client], recherche));

  // apresSucces n'est joué que si l'action a réussi : un champ vidé après un refus ferait
  // retaper la saisie à l'utilisateur.
  const agir = (action: () => Action, apresSucces?: () => void) => {
    startTransition(async () => {
      const r = await action();
      setErreur(r.success ? null : (r.error ?? "Échec."));
      if (r.success) apresSucces?.();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {erreur ? (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{ background: "var(--pal-red-bg)", color: "var(--pal-red-fg)" }}
        >
          {erreur}
        </p>
      ) : null}

      <SectionStaging
        couleur="var(--ev-blue)"
        icone={<Boxes className="size-4" />}
        titre="ONT annoncés"
        compteur={visibles.length}
      >
        <BarreRecherche
          valeur={recherche}
          onChange={setRecherche}
          placeholder="N° de série ou client"
          nbVisibles={visibles.length}
          nbTotal={annonces.length}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">Numéro de série</th>
              <th>Client</th>
              <th className="w-24">Saisi le</th>
              <th className="w-40">Reçu chez nous</th>
              <th className="w-52" />
            </tr>
          </thead>
          <tbody>
            <LigneAjout clients={clients} agir={agir} enCours={enCours} />
            {visibles.map((o) => (
              <LigneOnt key={o.id} ont={o} clients={clients} agir={agir} enCours={enCours} />
            ))}
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                  Aucun ONT en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-amber)"
        icone={<PackageCheck className="size-4" />}
        titre="Lot en préparation"
        compteur={lotOuvert?.articles.length ?? 0}
      >
        <LotEnPreparation lot={lotOuvert} agir={agir} enCours={enCours} />
      </SectionStaging>

      <SectionStaging
        couleur="var(--ev-green)"
        icone={<Send className="size-4" />}
        titre="Lots partis"
        compteur={lotsPartis.length}
      >
        <div className="flex flex-col gap-4">
          {lotsPartis.map((lot) => (
            <div
              key={lot.id}
              className="flex flex-col gap-2 rounded-xl border p-4"
              style={{ borderColor: "var(--ev-card-border)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{lot.destinataire}</span>
                <span className="text-xs text-muted-foreground">
                  {lot.articles.length} ONT · parti le {lot.expedieLe}
                </span>
              </div>
              <FriseColis
                etape={lot.suiviEtape}
                libelle={lot.suiviLibelle}
                livreLe={lot.suiviLivreLe}
                transporteur={lot.transporteur}
                numeroSuivi={lot.numeroSuivi}
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                {lot.articles.map((a) => a.numeroSerie).join(" · ")}
              </p>
            </div>
          ))}
          {lotsPartis.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Aucun lot expédié.</p>
          ) : null}
        </div>
      </SectionStaging>
    </div>
  );
}

// Première ligne du tableau : la saisie directe au staging, pour un ONT arrivé dans un carton
// sans avoir été déclaré sur site. Toujours visible, pas cachée derrière un bouton « ajouter ».
function LigneAjout({
  clients,
  agir,
  enCours,
}: {
  clients: ClientOption[];
  agir: (action: () => Action, apresSucces?: () => void) => void;
  enCours: boolean;
}) {
  const [numero, setNumero] = useState("");
  const [clientId, setClientId] = useState("");
  const [recu, setRecu] = useState(true);

  const vider = () => {
    setNumero("");
    setClientId("");
    setRecu(true);
  };

  return (
    <tr style={{ background: "var(--ev-surface)" }}>
      <td className="py-2 pr-3">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="N° de série à ajouter"
          className={`${CHAMP} w-full font-mono`}
        />
      </td>
      <td className="pr-3">
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={`${CHAMP} w-full`}
        >
          <option value="">Client inconnu</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.raisonSociale}
            </option>
          ))}
        </select>
      </td>
      <td className="text-xs text-muted-foreground">—</td>
      <td>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={recu} onChange={(e) => setRecu(e.target.checked)} />
          déjà arrivé
        </label>
      </td>
      <td className="text-right">
        <button
          type="button"
          disabled={enCours || !numero.trim()}
          onClick={() => agir(() => creerOntAction({ numeroSerie: numero, clientId: clientId || null, recu }), vider)}
          className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
        >
          <Plus className="size-3.5" />
          Ajouter
        </button>
      </td>
    </tr>
  );
}

// Une ligne d'ONT, en lecture ou en correction. La correction sert surtout aux numéros relevés
// de travers sur une étiquette, qui sinon resteraient faux jusqu'au grossiste.
function LigneOnt({
  ont,
  clients,
  agir,
  enCours,
}: {
  ont: OntLigne;
  clients: ClientOption[];
  agir: (action: () => Action, apresSucces?: () => void) => void;
  enCours: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [numero, setNumero] = useState(ont.numeroSerie);
  const [clientId, setClientId] = useState(ont.clientId ?? "");

  if (edition) {
    return (
      <tr className="border-t" style={{ borderColor: "var(--ev-row-border)" }}>
        <td className="py-2 pr-3">
          <input
            value={numero}
            autoFocus
            onChange={(e) => setNumero(e.target.value)}
            className={`${CHAMP} w-full font-mono`}
          />
        </td>
        <td className="pr-3">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={`${CHAMP} w-full`}
          >
            <option value="">Client inconnu</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale}
              </option>
            ))}
          </select>
        </td>
        <td className="text-xs text-muted-foreground">{ont.saisiLe}</td>
        <td className="text-xs text-muted-foreground">{ont.dateReception ?? "en attente"}</td>
        <td>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              disabled={enCours}
              title="Enregistrer la correction"
              onClick={() =>
                agir(
                  () => modifierOntAction(ont.id, { numeroSerie: numero, clientId: clientId || null }),
                  () => setEdition(false)
                )
              }
              className={BOUTON_ICONE}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              title="Annuler"
              onClick={() => {
                setNumero(ont.numeroSerie);
                setClientId(ont.clientId ?? "");
                setEdition(false);
              }}
              className={BOUTON_ICONE}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t" style={{ borderColor: "var(--ev-row-border)" }}>
      <td className="py-2 font-mono text-xs">{ont.numeroSerie}</td>
      <td>{ont.client ?? "—"}</td>
      <td className="text-xs text-muted-foreground">{ont.saisiLe}</td>
      <td>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!ont.dateReception}
            disabled={enCours}
            onChange={(e) => agir(() => cocherReceptionOntAction(ont.id, e.target.checked))}
          />
          {ont.dateReception ?? "en attente"}
        </label>
      </td>
      <td>
        <div className="flex justify-end gap-1">
          <button
            type="button"
            disabled={!ont.dateReception || enCours}
            onClick={() => agir(() => verserDansLotAction(ont.id))}
            className="h-7 rounded-md border px-2 text-xs hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
            title={ont.dateReception ? "Ajouter au lot en préparation" : "Cochez d'abord la réception"}
          >
            Ajouter au lot
          </button>
          <button
            type="button"
            disabled={enCours}
            title="Corriger le numéro ou le client"
            onClick={() => setEdition(true)}
            className={BOUTON_ICONE}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={enCours}
            title="Supprimer cet ONT"
            onClick={() => agir(() => supprimerOntAction(ont.id))}
            className={BOUTON_ICONE}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function LotEnPreparation({
  lot,
  agir,
  enCours,
}: {
  lot: LotOnt | null;
  agir: (action: () => Action, apresSucces?: () => void) => void;
  enCours: boolean;
}) {
  const [destinataire, setDestinataire] = useState(lot?.destinataire ?? "");
  const [transporteur, setTransporteur] = useState("Chronopost");
  const [numeroSuivi, setNumeroSuivi] = useState("");

  if (!lot || lot.articles.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Aucun ONT dans le lot. Cochez la réception d&apos;un ONT puis ajoutez-le.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {lot.articles.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 border-b py-1.5 text-sm"
            style={{ borderColor: "var(--ev-row-border)" }}
          >
            <span className="font-mono text-xs">{a.numeroSerie}</span>
            <span className="flex-1 text-xs text-muted-foreground">{a.client ?? "—"}</span>
            <button
              type="button"
              disabled={enCours}
              onClick={() => agir(() => retirerDuLotAction(a.id))}
              className="h-7 rounded-md border px-2 text-xs hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={destinataire}
          onChange={(e) => setDestinataire(e.target.value)}
          placeholder="Destinataire (grossiste)"
          className="h-8 w-56 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:border-ring"
        />
        <select
          value={transporteur}
          onChange={(e) => setTransporteur(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:border-ring"
        >
          <option>Chronopost</option>
          <option>DHL</option>
        </select>
        <input
          value={numeroSuivi}
          onChange={(e) => setNumeroSuivi(e.target.value)}
          placeholder="N° de suivi"
          className="h-8 w-44 rounded-md border border-input bg-transparent px-2 font-mono text-xs outline-none focus:border-ring"
        />
        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            agir(
              () => cloreLotAction({ destinataire, transporteur, numeroSuivi }),
              () => setNumeroSuivi("")
            )
          }
          className="h-8 rounded-md border px-3 text-xs font-semibold hover:bg-[var(--ev-row-hover)] disabled:opacity-40"
        >
          Expédier le lot
        </button>
      </div>
    </div>
  );
}
