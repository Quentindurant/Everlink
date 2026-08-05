"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdvOverview, DossierAdv, TechnicienLigne } from "@/lib/repositories/technicienRepository";
import type { TechnicienLite } from "@/lib/domain/technicien/disponibilite";
import type { EtapeMigrationLite } from "@/lib/domain/migration/etapes";
import { DispoFiltre, TechniciensManager } from "./TechniciensManager";
import { ImportTechniciens } from "./ImportTechniciens";
import { ZohoLiveView } from "./ZohoLiveView";
import { GestionDossiers } from "./GestionDossiers";

const ONGLETS = ["Dossiers", "Pilotage", "Suivi Zoho", "Techniciens"] as const;
type Onglet = (typeof ONGLETS)[number];

// URL d'édition du classeur Zoho — ouverte dans une fenêtre dédiée (les ADV sont déjà
// connectées à Zoho: elles voient leur vrai tableau, en direct, éditable).
const ZOHO_URL = "https://sheet.zoho.eu/sheet/open/36x6e6110bc0a380e4502aa19a2846f5908ba";

function ouvrirFenetreZoho() {
  window.open(
    ZOHO_URL,
    "zoho-suivi",
    "width=1400,height=850,menubar=no,toolbar=no,location=no,status=no"
  );
}

export function AdvTabs({
  overview,
  dossiers,
  etapes,
  techniciens,
  prestataires,
  disponibles,
  dateStr,
  departement,
}: {
  overview: AdvOverview;
  dossiers: DossierAdv[];
  etapes: EtapeMigrationLite[];
  techniciens: TechnicienLigne[];
  prestataires: { id: string; nom: string }[];
  disponibles: TechnicienLite[];
  dateStr: string;
  departement: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>("Dossiers");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b">
        {ONGLETS.map((o) => (
          <button
            key={o}
            onClick={() => setOnglet(o)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
              onglet === o
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {o}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mb-1.5 ml-auto"
          onClick={ouvrirFenetreZoho}
        >
          <ExternalLink data-icon="inline-start" />
          Ouvrir le tableau Zoho
        </Button>
      </div>

      {onglet === "Dossiers" && (
        <GestionDossiers dossiers={dossiers} etapes={etapes} techniciens={techniciens} />
      )}

      {onglet === "Pilotage" && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                Portabilité — par étape
              </h2>
              <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3 shadow-xs">
                {overview.parEtape.map((e) => (
                  <span
                    key={e.libelle}
                    className="ev-badge"
                    style={{
                      background: `color-mix(in oklab, ${e.couleur} 14%, white)`,
                      color: `color-mix(in oklab, ${e.couleur} 58%, oklch(0.3 0.015 240))`,
                    }}
                  >
                    <span className="ev-badge-dot" style={{ background: e.couleur }} />
                    {e.libelle}
                    <span className="rounded bg-black/10 px-1 font-mono tabular-nums">{e.count}</span>
                  </span>
                ))}
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
                Commandes de lien
              </h2>
              <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3 shadow-xs">
                <Badge variant="outline" className="tabular-nums">
                  Non commandé : {overview.liens.nonCommande}
                </Badge>
                <Badge className="border-transparent bg-blue-500/15 text-blue-700 tabular-nums dark:text-blue-400">
                  Commandé : {overview.liens.commande}
                </Badge>
                <Badge className="border-transparent bg-emerald-500/15 text-emerald-700 tabular-nums dark:text-emerald-400">
                  Livré : {overview.liens.livre}
                </Badge>
              </div>
            </section>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              Techniciens affectés
            </h2>
            {overview.affectes.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Aucun technicien affecté. Affectez-en depuis une fiche client.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {["Client", "Technicien", "Date intervention", "Étape"].map((h) => (
                        <TableHead key={h} className="text-xs font-semibold text-muted-foreground">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.affectes.map((a) => (
                      <TableRow key={a.clientId}>
                        <TableCell className="font-medium">
                          <Link href={`/clients/${a.clientId}`} className="hover:underline">
                            {a.raisonSociale}
                          </Link>
                        </TableCell>
                        <TableCell>{a.technicienNom}</TableCell>
                        <TableCell className="tabular-nums">
                          {a.dateIso ? new Date(a.dateIso).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell>{a.etape ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      )}

      {onglet === "Suivi Zoho" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex-1 text-sm text-muted-foreground">
              Le tableau s&apos;ouvre dans sa propre fenêtre, tel quel, en direct (connexion Zoho
              requise). Ci-dessous, un aperçu lecture seule rafraîchi automatiquement.
            </div>
            <Button onClick={ouvrirFenetreZoho}>
              <ExternalLink data-icon="inline-start" />
              Ouvrir le tableau Zoho
            </Button>
          </div>
          <ZohoLiveView />
        </div>
      )}

      {onglet === "Techniciens" && (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <DispoFiltre date={dateStr} departement={departement} />
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              Disponibles le {new Date(dateStr).toLocaleDateString("fr-FR")}
              {departement ? ` · dép. ${departement}` : ""}
            </h2>
            {disponibles.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Aucun technicien disponible (tous affectés, ou aucun ne couvre ce département).
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {disponibles.map((t) => (
                  <Badge key={t.id} variant="outline" className="px-3 py-1 text-sm">
                    {t.nom}
                    {t.departements.length > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        {t.departements.join("/")}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              Référentiel
            </h2>
            <ImportTechniciens />
            <TechniciensManager techniciens={techniciens} prestataires={prestataires} />
          </section>
        </div>
      )}
    </div>
  );
}
