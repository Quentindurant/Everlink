import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Cable,
  FileUp,
  PencilLine,
  MapPinned,
  Route,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchClientDetail } from "@/lib/repositories/clientsRepository";
import { listEtapesMigration } from "@/lib/repositories/migrationRepository";
import { fetchEnvois, listModelesMail } from "@/lib/repositories/mailRepository";
import { fetchTechniciensDisponibles } from "@/lib/repositories/technicienRepository";
import { PageHero } from "@/components/PageHero";
import { CopiePuce } from "@/components/CopiePuce";
import { horodateParis } from "@/lib/domain/horodatage";
import { SectionStaging } from "@/app/(app)/staging/SectionStaging";
import { SitesClient } from "./SitesClient";
import { FicheClient } from "./FicheClient";
import { FicheMigrationHeader } from "./FicheMigrationHeader";
import { CarteLien } from "./CarteLien";
import { AffectationTechnicien } from "./AffectationTechnicien";
import { ImportSewanUsers } from "./ImportSewanUsers";
import { ImportSewanDevices } from "./ImportSewanDevices";
import { ImportSewanNumeros } from "./ImportSewanNumeros";
import { BoutonZoho } from "./BoutonZoho";

export const dynamic = "force-dynamic";

// Champ étiqueté de la carte d'identité : libellé discret au-dessus, valeur en dessous.
function Info({ etiquette, valeur, copiable }: { etiquette: string; valeur: string | null; copiable?: boolean }) {
  if (!valeur) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiquette}
      </span>
      {copiable ? (
        <CopiePuce valeur={valeur} titre={etiquette} />
      ) : (
        <span className="text-[13px]">{valeur}</span>
      )}
    </div>
  );
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { onglet } = await searchParams;
  const [detail, etapesMigration, modelesMail, envoisRaw] = await Promise.all([
    fetchClientDetail(id),
    listEtapesMigration(),
    listModelesMail(),
    fetchEnvois(id),
  ]);
  if (!detail) notFound();
  const { client, etapes } = detail;

  // Techniciens disponibles à la date d'intervention (ou tous les actifs si pas de date).
  const techniciensDisponibles = await fetchTechniciensDisponibles(
    client.dateIntervention ?? new Date(),
    client.departement ?? undefined,
    client.technicienId
  );

  const envois = envoisRaw.map((e) => ({
    id: e.id,
    type: e.type,
    destinataire: e.destinataire,
    objet: e.objet,
    corps: e.corps,
    succes: e.succes,
    erreur: e.erreur,
    creeLe: horodateParis(e.creeLe),
    auteurEmail: e.auteur?.nom ?? e.auteur?.email ?? null,
    suiviStatut: e.suiviStatut,
  }));

  // Avancement de la bascule téléphonie, repris en KPI du bandeau.
  const nbCellulesSuivi = client.utilisateurs.length * etapes.length;
  const nbFaits = client.utilisateurs
    .flatMap((u) => u.suivis)
    .filter((s) => s.statut === "Fait").length;
  const pctSuivi = nbCellulesSuivi > 0 ? Math.round((nbFaits / nbCellulesSuivi) * 100) : 0;

  const contact = [client.contactPrenom, client.contactNom].filter(Boolean).join(" ") || null;

  // Client multi-établissements : une carte par site, avec le nombre de postes rattachés.
  const sites = client.sites.map((s) => ({
    id: s.id,
    nom: s.nom,
    adresse: s.adresse,
    dateInterventionIso: s.dateIntervention?.toISOString().slice(0, 10) ?? null,
    creneau: s.creneauIntervention,
    contact: [s.contactPrenom, s.contactNom].filter(Boolean).join(" ") || null,
    telephone: s.contactMobile ?? s.contactFixe,
    email: s.contactEmail,
    nbPostesAnnonce: s.nbPostesAnnonce,
    nbPostes: client.utilisateurs.filter((u) => u.siteId === s.id).length,
    principal: s.principal,
  }));

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Client"
        title={client.raisonSociale}
        kpis={[
          { value: client.numeros.length, label: "numéros" },
          { value: client.equipements.length, label: "équipements" },
          { value: client.utilisateurs.length, label: "utilisateurs" },
          { value: `${pctSuivi}%`, label: "basculé", color: "var(--ev-green)" },
          ...(client.sites.length > 1
            ? [{ value: client.sites.length, label: "sites", color: "var(--ev-purple)" }]
            : []),
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          style={{ borderColor: "var(--ev-card-border)" }}
        >
          <ArrowLeft className="size-3" />
          Clients
        </Link>
        {client.lot && (
          <Link href="/lots">
            <Badge variant="outline">{client.lot.nom}</Badge>
          </Link>
        )}
        {client.clientVip && (
          <Badge className="border-transparent bg-[var(--pal-amber-bg)] text-[color:var(--pal-amber-fg)]">
            VIP
          </Badge>
        )}
        <Button
          size="sm"
          className="ml-auto"
          nativeButton={false}
          render={<Link href={`/provisionning?client=${client.id}`} />}
        >
          <PencilLine data-icon="inline-start" />
          Saisir les utilisateurs et numéros
        </Button>
      </div>

      {/* Plusieurs adresses pour une même raison sociale : la téléphonie reste commune. */}
      {sites.length > 1 && (
        <SectionStaging
          couleur="var(--ev-purple)"
          icone={<MapPinned className="size-4" />}
          titre="Sites"
          compteur={sites.length}
        >
          <div className="p-4">
            <p className="mb-3 text-[12px] text-muted-foreground">
              Une seule téléphonie pour ce client : les postes des différents sites s&apos;appellent
              entre eux. Seules les interventions et les adresses sont propres à chaque site.
            </p>
            <SitesClient sites={sites} />
          </div>
        </SectionStaging>
      )}

      {/* Identité + parcours de migration, côte à côte : qui c'est, où on en est. */}
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionStaging
          couleur="var(--ev-blue)"
          icone={<Building2 className="size-4" />}
          titre="Client"
        >
          <div className="flex flex-col gap-3 p-4">
            <Info etiquette="Scénario" valeur={client.scenario} />
            <Info etiquette="Adresse" valeur={client.adresse} />
            <Info etiquette="Contact" valeur={contact} />
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <Info etiquette="Téléphone" valeur={client.contactMobile ?? client.contactFixe} copiable />
              <Info etiquette="Email" valeur={client.contactEmail} copiable />
            </div>
            {!client.scenario && !client.adresse && !contact && !client.contactEmail && (
              <p className="text-sm text-muted-foreground">
                Aucune information Monday — lancez un import Monday.
              </p>
            )}
          </div>
        </SectionStaging>

        <div className="xl:col-span-2">
          <SectionStaging
            couleur="var(--ev-purple)"
            icone={<Route className="size-4" />}
            titre="Migration"
          >
            <FicheMigrationHeader
              clientId={client.id}
              etapes={etapesMigration}
              etapeCouranteId={client.etapeMigrationId}
              nbTentativesContact={client.nbTentativesContact}
              dernierContactLe={
                client.dernierContactLe ? client.dernierContactLe.toISOString().slice(0, 10) : null
              }
              referenceClient={client.referenceClient}
            />
          </SectionStaging>
        </div>
      </div>

      {/* Lien opérateur + intervention : les deux dépendances avant d'installer. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionStaging
          couleur="var(--ev-amber)"
          icone={<Cable className="size-4" />}
          titre="Lien opérateur"
        >
          <CarteLien
            clientId={client.id}
            scenario={client.scenario}
            lien={{
              lienCommande: client.lienCommande,
              lienCommandeLe: client.lienCommandeLe ? client.lienCommandeLe.toISOString().slice(0, 10) : null,
              lienCommandePar: client.lienCommandePar,
              lienOperateur: client.lienOperateur,
              lienReference: client.lienReference,
              lienLivraisonPrevue: client.lienLivraisonPrevue ? client.lienLivraisonPrevue.toISOString().slice(0, 10) : null,
              lienLivre: client.lienLivre,
              lienLivreLe: client.lienLivreLe ? client.lienLivreLe.toISOString().slice(0, 10) : null,
            }}
          />
        </SectionStaging>

        <SectionStaging
          couleur="var(--ev-cyan)"
          icone={<Wrench className="size-4" />}
          titre="Intervention"
        >
          <AffectationTechnicien
            clientId={client.id}
            technicienId={client.technicienId}
            disponibles={techniciensDisponibles.map((t) => ({ id: t.id, nom: t.nom }))}
            dateIso={client.dateIntervention ? client.dateIntervention.toISOString().slice(0, 10) : null}
            departement={client.departement}
          />
        </SectionStaging>
      </div>

      {/* Imports Sewan + push Zoho : les actions qui alimentent le dossier. */}
      <SectionStaging
        couleur="var(--ev-green)"
        icone={<FileUp className="size-4" />}
        titre="Imports Sewan · Zoho"
      >
        <div className="flex flex-wrap items-center gap-3 p-4">
          <ImportSewanUsers clientId={client.id} />
          <ImportSewanDevices clientId={client.id} />
          <ImportSewanNumeros clientId={client.id} />
          <div className="ml-auto">
            <BoutonZoho
              clientId={client.id}
              dejaPousseLe={
                client.zohoLignePousseeLe ? client.zohoLignePousseeLe.toLocaleDateString("fr-FR") : null
              }
            />
          </div>
        </div>
      </SectionStaging>

      <FicheClient
        detail={detail}
        modelesMail={modelesMail}
        envois={envois}
        numeroGc={process.env.NUMERO_GC ?? ""}
        ongletInitial={onglet}
      />
    </main>
  );
}
