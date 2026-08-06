import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toucherPresence } from "@/lib/activite";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (session?.user?.email) await toucherPresence(session.user.email);

  // Progression réelle des bascules sur les numéros actifs, pour le widget de la sidebar.
  const [total, faites] = await Promise.all([
    prisma.numero.count({ where: { archiveA: null, client: { archiveA: null } } }),
    prisma.numero.count({
      where: { archiveA: null, client: { archiveA: null }, statutBascule: "Fait" },
    }),
  ]);
  const progression = {
    faites,
    total,
    pct: total > 0 ? Math.round((faites / total) * 100) : 0,
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
