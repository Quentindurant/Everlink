import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toucherPresence } from "@/lib/activite";
import { STATUTS_ETAPE_RESOLUS } from "@/lib/domain/telephone/statuts";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (session?.user?.email) await toucherPresence(session.user.email);

  // Avancement du chantier = étapes de migration réellement cochées poste par poste (page
  // Téléphone). C'est là que l'équipe travaille ; le statut de bascule par numéro n'est plus
  // renseigné et laissait la jauge à 0 % en permanence.
  const [postes, etapesActives, resolues] = await Promise.all([
    prisma.utilisateur.count({ where: { archiveA: null, client: { archiveA: null } } }),
    prisma.etapeModele.count({ where: { actif: true } }),
    prisma.suiviEtape.count({
      where: {
        statut: { in: STATUTS_ETAPE_RESOLUS },
        etape: { actif: true },
        utilisateur: { archiveA: null, client: { archiveA: null } },
      },
    }),
  ]);
  const total = postes * etapesActives;
  const progression = {
    faites: resolues,
    total,
    pct: total > 0 ? Math.round((resolues / total) * 100) : 0,
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--ev-surface)" }}>
      <AppSidebar
        email={session?.user?.email ?? ""}
        role={session?.user?.role ?? "OPERATEUR"}
        onLogout={logoutAction}
        progression={progression}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette />
    </div>
  );
}
