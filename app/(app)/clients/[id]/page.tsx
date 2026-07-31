import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchClientDetail } from "@/lib/repositories/clientsRepository";
import { listEtapesMigration } from "@/lib/repositories/migrationRepository";
import { FicheClient } from "./FicheClient";
import { FicheMigrationHeader } from "./FicheMigrationHeader";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, etapesMigration] = await Promise.all([
    fetchClientDetail(id),
    listEtapesMigration(),
  ]);
  if (!detail) notFound();
  const { client } = detail;

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
      <FicheClient detail={detail} />
    </main>
  );
}
