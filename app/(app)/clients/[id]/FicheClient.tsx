"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClientDetail } from "@/lib/repositories/clientsRepository";
import type { ModeleMailLite } from "@/lib/repositories/mailRepository";
import { horodateParis } from "@/lib/domain/horodatage";
import { estEtapeResolue } from "@/lib/domain/telephone/statuts";
import { OngletMails, type EnvoiLigne } from "./OngletMails";

const NIVEAU_CLASSES: Record<string, string> = {
  OK: "border-transparent bg-[var(--pal-green-bg)] text-[color:var(--pal-green-fg)]",
  AVERTISSEMENT: "border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]",
  ERREUR: "border-transparent bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]",
};

const ONGLETS = [
  "Numéros",
  "Équipements",
  "Utilisateurs",
  "Suivi téléphonie",
  "Mails",
  "Monday",
  "Historique",
] as const;
type Onglet = (typeof ONGLETS)[number];

function EnteteTableau({ colonnes }: { colonnes: string[] }) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {colonnes.map((c) => (
          <TableHead
            key={c}
            className="h-9 text-xs font-semibold whitespace-nowrap text-muted-foreground"
          >
            {c}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function FicheClient({
  detail,
  modelesMail,
  envois,
  numeroGc,
  ongletInitial,
}: {
  detail: ClientDetail;
  modelesMail: ModeleMailLite[];
  envois: EnvoiLigne[];
  numeroGc: string;
  ongletInitial?: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>(
    ONGLETS.includes(ongletInitial as Onglet) ? (ongletInitial as Onglet) : "Numéros"
  );
  const { client, etapes, auditLogs } = detail;

  const nbCellulesSuivi = client.utilisateurs.length * etapes.length;
  const nbFaits = client.utilisateurs
    .flatMap((u) => u.suivis)
    .filter((s) => estEtapeResolue(s.statut)).length;
  const pctSuivi = nbCellulesSuivi > 0 ? Math.round((nbFaits / nbCellulesSuivi) * 100) : 0;

  const mondayRaw = (client.mondayRaw ?? null) as Record<string, unknown> | null;

  // Compteur affiché dans l'onglet : on voit d'un coup d'œil ce qui est rempli.
  const compteurs: Partial<Record<Onglet, string | number>> = {
    "Numéros": client.numeros.length,
    "Équipements": client.equipements.length,
    "Utilisateurs": client.utilisateurs.length,
    "Suivi téléphonie": `${pctSuivi}%`,
    "Mails": envois.length,
    "Historique": auditLogs.length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 overflow-x-auto border-b">
        {ONGLETS.map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              onglet === o
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {o}
            {compteurs[o] !== undefined && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-bold tabular-nums",
                  onglet === o
                    ? "bg-[var(--pal-blue-bg)] text-[color:var(--pal-blue-fg)]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {compteurs[o]}
              </span>
            )}
          </button>
        ))}
      </div>

      {onglet === "Numéros" && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <EnteteTableau
              colonnes={["Numéro", "Numéros courts", "Contrôle", "Utilisateur", "Bascule", "Date", "Commentaire"]}
            />
            <TableBody>
              {client.numeros.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-[13px] tabular-nums">{n.numeroBrut}</TableCell>
                  <TableCell className="font-mono text-[13px]">{n.numerosCourts.join("/") || "—"}</TableCell>
                  <TableCell>
                    <Badge className={NIVEAU_CLASSES[n.controleNiveau]}>
                      {n.controleNiveau}
                      {n.controleForce ? " (forcé)" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>{n.utilisateur?.nom ?? "—"}</TableCell>
                  <TableCell>{n.statutBascule}</TableCell>
                  <TableCell className="tabular-nums">
                    {n.dateBascule ? n.dateBascule.toISOString().slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={n.commentaire ?? undefined}>
                    {n.commentaire ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {onglet === "Équipements" && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <EnteteTableau colonnes={["Modèle", "MAC", "Utilisateur", "Éligible export", "Commentaire"]} />
            <TableBody>
              {client.equipements.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.modele?.libelle ?? e.modeleLibelleBrut ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[13px]">{e.macBrut}</TableCell>
                  <TableCell>{e.utilisateur?.nom ?? "—"}</TableCell>
                  <TableCell>
                    {e.modele?.eligibleExport ? (
                      <Badge className={NIVEAU_CLASSES.OK}>Oui</Badge>
                    ) : (
                      <Badge variant="outline">
                        Non{e.modele ? "" : " (modèle inconnu)"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={e.commentaire ?? undefined}>
                    {e.commentaire ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {onglet === "Utilisateurs" && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <EnteteTableau colonnes={["Nom", "Étapes faites", "Commentaire"]} />
            <TableBody>
              {client.utilisateurs.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nom}</TableCell>
                  <TableCell className="tabular-nums">
                    {u.suivis.filter((s) => estEtapeResolue(s.statut)).length}/{etapes.length}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">{u.commentaire ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {onglet === "Suivi téléphonie" && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <Table>
            <EnteteTableau colonnes={["Utilisateur", ...etapes.map((e) => e.libelle)]} />
            <TableBody>
              {client.utilisateurs.map((u) => {
                const parEtape = new Map(u.suivis.map((s) => [s.etapeId, s.statut]));
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium whitespace-nowrap">{u.nom}</TableCell>
                    {etapes.map((e) => {
                      const statut = parEtape.get(e.id) ?? "À faire";
                      return (
                        <TableCell key={e.id}>
                          <Badge
                            variant="outline"
                            className={cn(
                              statut === "Fait" && NIVEAU_CLASSES.OK,
                              statut === "En cours" && NIVEAU_CLASSES.AVERTISSEMENT
                            )}
                          >
                            {statut}
                          </Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t p-3 text-xs text-muted-foreground">
            Édition des statuts sur la page{" "}
            <Link href={`/telephone?client=${client.id}`} className="underline">
              Téléphone
            </Link>
            .
          </p>
        </div>
      )}

      {onglet === "Mails" && (
        <OngletMails
          clientInfo={{
            id: client.id,
            scenario: client.scenario,
            raisonSociale: client.raisonSociale,
            filiale: client.filiale,
            adresse: client.adresse,
            contactNom: client.contactNom,
            contactPrenom: client.contactPrenom,
            contactEmail: client.contactEmail,
            dateIso: client.dateIntervention ? client.dateIntervention.toISOString().slice(0, 10) : null,
            creneau: client.creneauIntervention,
          }}
          modeles={modelesMail}
          envois={envois}
          numeroGc={numeroGc}
        />
      )}

      {onglet === "Monday" && (
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          {mondayRaw ? (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(mondayRaw).map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd>{v === null || v === "" ? "—" : String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune donnée Monday pour ce client. Lancez un import Monday pour les alimenter.
            </p>
          )}
        </div>
      )}

      {onglet === "Historique" && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          {auditLogs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune modification enregistrée.</p>
          ) : (
            <Table>
              <EnteteTableau colonnes={["Date", "Entité", "Action", "Champ", "Avant", "Après", "Auteur"]} />
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {horodateParis(log.creeLe)}
                    </TableCell>
                    <TableCell>{log.entite}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.champ ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate" title={log.avant ?? undefined}>
                      {log.avant ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={log.apres ?? undefined}>
                      {log.apres ?? "—"}
                    </TableCell>
                    <TableCell>{log.auteur?.email ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
