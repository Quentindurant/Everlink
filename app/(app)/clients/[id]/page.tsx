import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchClientDetail } from "@/lib/repositories/clientsRepository";
import { listEtapesMigration } from "@/lib/repositories/migrationRepository";
import { fetchEnvois, listModelesMail } from "@/lib/repositories/mailRepository";
import { FicheClient } from "./FicheClient";
import { FicheMigrationHeader } from "./FicheMigrationHeader";
import { CarteLien } from "./CarteLien";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, etapesMigration, modelesMail, envoisRaw] = await Promise.all([
    fetchClientDetail(id),
    listEtapesMigration(),
    listModelesMail(),
    fetchEnvois(id),
  ]);
  if (!detail) notFound();
  const { client } = detail;

  const envois = envoisRaw.map((e) => ({
    id: e.id,
    type: e.type,
    destinataire: e.destinataire,
    objet: e.objet,
    succes: e.succes,
    erreur: e.erreur,
    creeLe: e.creeLe.toISOString().slice(0, 16).replace("T", " "),
    auteurEmail: e.auteur?.email ?? null,
  }));

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <Link
          href="/clients"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Clients
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{client.raisonSociale}</h1>
          {client.lot && (
            <Link href={`/lots`}>
              <Badge variant="outline">{client.lot.nom}</Badge>
            </Link>
          )}
          {client.clientVip && (
            <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
              VIP
            </Badge>
          )}
          <Button size="sm" className="ml-auto" render={<Link href={`/?client=${client.id}`} />}>
            <PencilLine data-icon="inline-start" />
            Saisir les utilisateurs et numéros
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[
            client.scenario,
            client.adresse,
            [client.contactPrenom, client.contactNom].filter(Boolean).join(" "),
            client.contactMobile ?? client.contactFixe,
            client.contactEmail,
          ]
            .filter(Boolean)
            .join(" · ") || "Aucune information Monday."}
        </p>
      </header>
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
      <FicheClient
        detail={detail}
        modelesMail={modelesMail}
        envois={envois}
        numeroGc={process.env.NUMERO_GC ?? ""}
      />
    </main>
  );
}
