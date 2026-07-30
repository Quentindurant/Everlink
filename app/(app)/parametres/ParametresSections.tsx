"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import type { CategorieListe } from "@prisma/client";
import type {
  CompteLigne,
  EtapeLigne,
  ModeleLigne,
  ValeurListe,
} from "@/lib/repositories/parametresRepository";
import {
  ajouterEtapeAction,
  ajouterValeurAction,
  creerCompteAction,
  creerModeleAction,
  deplacerEtapeAction,
  lancerSyncAction,
  recalculerControleGlobalAction,
  renommerEtapeAction,
  resetMotDePasseAction,
  setCompteActifAction,
  setEtapeActifAction,
  setModeleEligibiliteAction,
  setValeurActifAction,
  supprimerValeurAction,
} from "./actions";

function Erreur({ texte }: { texte: string | null }) {
  if (!texte) return null;
  return <span className="text-sm text-destructive">{texte}</span>;
}

function Section({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{titre}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Modèles

export function SectionModeles({ modeles }: { modeles: ModeleLigne[] }) {
  const [libelle, setLibelle] = useState("");
  const [marque, setMarque] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nbEligibles = modeles.filter((m) => m.eligibleExport).length;

  return (
    <Section
      titre="Modèles d'équipement"
      description={`${nbEligibles} modèle(s) éligible(s) à l'export. Basculer l'éligibilité change immédiatement les prévisualisations SDA et MAC.`}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input placeholder="Libellé (ex. Yealink T58W)" value={libelle} onChange={(e) => setLibelle(e.target.value)} className="w-56" />
        <Input placeholder="Marque" value={marque} onChange={(e) => setMarque(e.target.value)} className="w-40" />
        <Button
          size="sm"
          disabled={!libelle.trim() || !marque.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await creerModeleAction(libelle, marque);
              if (r.success) {
                setLibelle("");
                setMarque("");
                setErreur(null);
              } else setErreur(r.error ?? null);
            })
          }
        >
          <Plus data-icon="inline-start" />
          Ajouter
        </Button>
        <Erreur texte={erreur} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Libellé", "Marque", "Équipements", "Éligible export"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modeles.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.libelle}</TableCell>
                <TableCell>{m.marque}</TableCell>
                <TableCell className="tabular-nums">{m.nbEquipements}</TableCell>
                <TableCell>
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={m.eligibleExport}
                      onCheckedChange={(v) =>
                        startTransition(async () => {
                          await setModeleEligibiliteAction(m.id, Boolean(v));
                        })
                      }
                    />
                    <span className={cn("text-sm", m.eligibleExport ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                      {m.eligibleExport ? "Oui" : "Non"}
                    </span>
                  </label>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- Listes

const LIBELLES_CATEGORIE: Record<string, string> = {
  HEBERGEUR: "Hébergeurs",
  STATUT_BASCULE: "Statuts de bascule",
  STATUT_ETAPE: "Statuts d'étape",
  SCENARIO: "Scénarios",
  TYPE_INTERVENTION: "Types d'intervention",
  STATUT_MONDAY: "Statuts Monday",
  TECHNO_LIEN: "Technologies de lien",
};

export function SectionListes({ listes }: { listes: Record<string, ValeurListe[]> }) {
  return (
    <Section
      titre="Listes déroulantes"
      description="Une valeur utilisée par un enregistrement ne peut être supprimée, seulement désactivée."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(listes).map(([categorie, valeurs]) => (
          <ListeCategorie
            key={categorie}
            categorie={categorie as CategorieListe}
            valeurs={valeurs}
          />
        ))}
      </div>
    </Section>
  );
}

function ListeCategorie({
  categorie,
  valeurs,
}: {
  categorie: CategorieListe;
  valeurs: ValeurListe[];
}) {
  const [nouvelle, setNouvelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="mb-2 text-sm font-medium">{LIBELLES_CATEGORIE[categorie] ?? categorie}</p>
      <ul className="flex flex-col gap-1">
        {valeurs.map((v) => (
          <li key={v.id} className="flex items-center gap-2 text-sm">
            <span className={cn(!v.actif && "text-muted-foreground line-through")}>{v.valeur}</span>
            {!v.actif && <Badge variant="outline">désactivée</Badge>}
            {v.utilisee && <Badge variant="outline" className="text-xs">utilisée</Badge>}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  startTransition(async () => {
                    await setValeurActifAction(v.id, !v.actif);
                  })
                }
              >
                {v.actif ? "Désactiver" : "Réactiver"}
              </Button>
              {!v.utilisee && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await supprimerValeurAction(v.id);
                      if (!r.success) setErreur(r.error ?? null);
                    })
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <Input
          placeholder="Nouvelle valeur"
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          className="h-7"
        />
        <Button
          size="xs"
          disabled={!nouvelle.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await ajouterValeurAction(categorie, nouvelle);
              if (r.success) {
                setNouvelle("");
                setErreur(null);
              } else setErreur(r.error ?? null);
            })
          }
        >
          <Plus />
        </Button>
      </div>
      <Erreur texte={erreur} />
    </div>
  );
}

// ---------------------------------------------------------------- Étapes

export function SectionEtapes({ etapes }: { etapes: EtapeLigne[] }) {
  const [nouvelle, setNouvelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Section titre="Étapes de suivi téléphonie" description="Ajout, renommage, réordonnancement et désactivation.">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Ordre", "Libellé", "Active", "Actions"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {etapes.map((e, i) => (
              <TableRow key={e.id}>
                <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="w-full">
                  <input
                    defaultValue={e.libelle}
                    onBlur={(ev) => {
                      if (ev.target.value !== e.libelle && ev.target.value.trim())
                        startTransition(async () => {
                          await renommerEtapeAction(e.id, ev.target.value);
                        });
                    }}
                    className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm outline-none hover:border-input focus:border-ring focus:ring-2 focus:ring-ring/40"
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={e.actif}
                    onCheckedChange={(v) =>
                      startTransition(async () => {
                        await setEtapeActifAction(e.id, Boolean(v));
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => startTransition(async () => { await deplacerEtapeAction(e.id, "haut"); })}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-xs" disabled={i === etapes.length - 1} onClick={() => startTransition(async () => { await deplacerEtapeAction(e.id, "bas"); })}>
                      <ArrowDown />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2">
        <Input placeholder="Nouvelle étape" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} className="w-72" />
        <Button
          size="sm"
          disabled={!nouvelle.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await ajouterEtapeAction(nouvelle);
              if (r.success) {
                setNouvelle("");
                setErreur(null);
              } else setErreur(r.error ?? null);
            })
          }
        >
          <Plus data-icon="inline-start" />
          Ajouter
        </Button>
        <Erreur texte={erreur} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- Comptes

export function SectionComptes({ comptes }: { comptes: CompteLigne[] }) {
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATEUR">("OPERATEUR");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <Section titre="Comptes" description="ADMIN : paramètres, comptes, imports. OPERATEUR : saisie et exports.">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-56" />
        <Input placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} className="w-40" />
        <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "OPERATEUR")} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
          <option value="OPERATEUR">OPERATEUR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <Input placeholder="Mot de passe (≥ 8)" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className="w-44" />
        <Button
          size="sm"
          disabled={!email.trim() || !nom.trim() || motDePasse.length < 8}
          onClick={() =>
            startTransition(async () => {
              const r = await creerCompteAction(email, nom, role, motDePasse);
              if (r.success) {
                setEmail("");
                setNom("");
                setMotDePasse("");
                setErreur(null);
              } else setErreur(r.error ?? null);
            })
          }
        >
          <Plus data-icon="inline-start" />
          Créer
        </Button>
        <Erreur texte={erreur} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {["Email", "Nom", "Rôle", "Actif", "Actions"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {comptes.map((c) => (
              <CompteRow key={c.id} compte={c} />
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function CompteRow({ compte }: { compte: CompteLigne }) {
  const [, startTransition] = useTransition();
  return (
    <TableRow>
      <TableCell className="font-medium">{compte.email}</TableCell>
      <TableCell>{compte.nom}</TableCell>
      <TableCell>
        <Badge variant="outline">{compte.role}</Badge>
      </TableCell>
      <TableCell>
        {compte.actif ? (
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Actif</Badge>
        ) : (
          <Badge variant="outline">Désactivé</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => startTransition(async () => { await setCompteActifAction(compte.id, !compte.actif); })}>
            {compte.actif ? "Désactiver" : "Réactiver"}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              const mdp = window.prompt("Nouveau mot de passe (≥ 8 caractères) :");
              if (mdp) startTransition(async () => { await resetMotDePasseAction(compte.id, mdp); });
            }}
          >
            Réinitialiser mot de passe
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------- Sync & contrôle

export function SectionSync({
  syncRuns,
}: {
  syncRuns: {
    id: string;
    declencheur: string;
    succes: boolean;
    creeLe: Date;
    ongletsEcrits: unknown;
    auteur: { email: string } | null;
  }[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Section titre="Synchronisation Google Sheets" description="Synchronisation sortante uniquement.">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
        L'application est la source de vérité. La synchronisation <strong>écrase</strong> les onglets
        du Sheet (Provisionning, Clients, Téléphone, Import SDA, Import MAC). Toute modification faite
        directement dans le Sheet sera perdue.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              setErreur(null);
              const r = await lancerSyncAction();
              if (r.success) setMessage("Synchronisation effectuée.");
              else setErreur(r.error ?? "Échec.");
            })
          }
        >
          <RefreshCw data-icon="inline-start" className={isPending ? "animate-spin" : ""} />
          Lancer la synchronisation
        </Button>
        {message && <span className="text-sm text-emerald-700 dark:text-emerald-400">{message}</span>}
        <Erreur texte={erreur} />
      </div>
      {syncRuns.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Date", "Déclencheur", "Onglets écrits", "Statut", "Auteur"].map((h) => (
                  <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncRuns.map((run) => {
                const onglets = run.ongletsEcrits as Record<string, number> | null;
                return (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {run.creeLe.toISOString().slice(0, 16).replace("T", " ")}
                    </TableCell>
                    <TableCell>{run.declencheur}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {onglets
                        ? Object.entries(onglets).map(([k, v]) => `${k}: ${v}`).join(" · ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {run.succes ? (
                        <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">OK</Badge>
                      ) : (
                        <Badge className="border-transparent bg-destructive/15 text-destructive">Erreur</Badge>
                      )}
                    </TableCell>
                    <TableCell>{run.auteur?.email ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

export function SectionControle() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <Section titre="Contrôle N° global" description="Recalcule le contrôle de tous les numéros actifs. Les contrôles forcés sont préservés.">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              const r = await recalculerControleGlobalAction();
              if (r.success) setMessage(`${r.nb} numéro(s) recalculé(s).`);
            })
          }
        >
          <RefreshCw data-icon="inline-start" className={isPending ? "animate-spin" : ""} />
          Recalculer maintenant
        </Button>
        {message && <span className="text-sm text-emerald-700 dark:text-emerald-400">{message}</span>}
      </div>
    </Section>
  );
}
