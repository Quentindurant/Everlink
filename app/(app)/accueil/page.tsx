import Link from "next/link";
import { AlertTriangle, CalendarClock, Link2, PhoneOff, PackageCheck, Truck } from "lucide-react";
import { fetchAccueil } from "@/lib/repositories/accueilRepository";
import { PageHero } from "@/components/PageHero";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const COULEUR_LIEN: Record<string, string> = {
  Livré: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  Commandé: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  "Non commandé": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function Carte({
  icone,
  valeur,
  label,
  couleur,
  href,
}: {
  icone: React.ReactNode;
  valeur: number;
  label: string;
  couleur: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${couleur} 10%, white)`, color: couleur }}>
        {icone}
      </span>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none">{valeur}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

export default async function AccueilPage() {
  const data = await fetchAccueil();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col gap-5 p-5 pb-15">
      <PageHero
        accentColor="var(--ev-blue)"
        label="Aujourd'hui"
        title="Vue<br />du jour"
        kpis={[
          { value: data.interventions.length, label: "interventions à venir" },
          { value: data.bloques.length, label: "bloqués", color: data.bloques.length ? "var(--ev-red)" : undefined },
          { value: data.aRelancer.length, label: "à relancer", color: data.aRelancer.length ? "var(--ev-amber)" : undefined },
        ]}
      />

      {/* Cartes d'accès rapide */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte icone={<Link2 className="size-5" />} valeur={data.liensACommander} label="liens à commander" couleur="var(--ev-blue)" href="/techniciens" />
        <Carte icone={<PackageCheck className="size-5" />} valeur={data.stock.enStock} label="routeurs en stock" couleur="var(--ev-cyan)" href="/staging" />
        <Carte icone={<Truck className="size-5" />} valeur={data.stock.aEnvoyer} label="à configurer/envoyer" couleur="var(--ev-purple)" href="/staging" />
        <Carte icone={<CalendarClock className="size-5" />} valeur={data.stock.aInstaller} label="routeurs à installer" couleur="var(--ev-green)" href="/staging" />
      </div>

      {/* Interventions à venir */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Interventions à venir</h2>
        </div>
        {data.interventions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucune intervention planifiée. Planifiez-les depuis l&apos;espace ADV.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Date", "Client", "Étape", "Lien", "Technicien"].map((h) => (
                    <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.interventions.map((i) => (
                  <TableRow key={i.clientId}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {i.dateIso === aujourdhui ? (
                        <Badge className="border-transparent bg-primary/15 text-primary">aujourd&apos;hui</Badge>
                      ) : (
                        new Date(i.dateIso).toLocaleDateString("fr-FR")
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${i.clientId}`} className="hover:underline">{i.raisonSociale}</Link>
                    </TableCell>
                    <TableCell className="text-xs">{i.etape ?? "—"}</TableCell>
                    <TableCell>
                      {i.lienStatut ? (
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${COULEUR_LIEN[i.lienStatut] ?? ""}`}>
                          {i.lienStatut}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{i.technicienNom ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Alertes : bloqués + à relancer */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Dossiers bloqués</h2>
            <Badge variant="outline" className="tabular-nums">{data.bloques.length}</Badge>
          </div>
          <div className="rounded-xl border bg-card p-2 shadow-xs">
            {data.bloques.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Aucun dossier bloqué. 👌</p>
            ) : (
              <ul className="flex flex-col">
                {data.bloques.map((b) => (
                  <li key={b.clientId} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-muted/50">
                    <Link href={`/clients/${b.clientId}`} className="text-sm font-medium hover:underline">{b.raisonSociale}</Link>
                    <span className="text-xs text-muted-foreground">{b.etape}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <PhoneOff className="size-4 text-amber-600" />
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">À relancer (3+ tentatives)</h2>
            <Badge variant="outline" className="tabular-nums">{data.aRelancer.length}</Badge>
          </div>
          <div className="rounded-xl border bg-card p-2 shadow-xs">
            {data.aRelancer.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Personne à relancer.</p>
            ) : (
              <ul className="flex flex-col">
                {data.aRelancer.map((r) => (
                  <li key={r.clientId} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-muted/50">
                    <Link href={`/clients/${r.clientId}`} className="text-sm font-medium hover:underline">{r.raisonSociale}</Link>
                    <Badge className="border-transparent bg-amber-500/15 text-amber-700 tabular-nums dark:text-amber-400">
                      {r.tentatives} tentatives
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
