import { auth } from "@/auth";
import { toucherPresence } from "@/lib/activite";
import { fetchProgressionChantier } from "@/lib/repositories/telephoneRepository";
import { compterNonLues } from "@/lib/repositories/notificationsRepository";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (session?.user?.email) await toucherPresence(session.user.email);

  // Avancement du chantier : un numéro = un poste, migré quand toutes ses étapes sont
  // résolues. Le statut de bascule par numéro n'étant plus renseigné, il laissait la jauge
  // à 0 % en permanence.
  const progression = await fetchProgressionChantier();
  const email = session?.user?.email ?? "";
  const nonLues = email ? await compterNonLues(email) : 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--ev-surface)" }}>
      <AppSidebar
        email={session?.user?.email ?? ""}
        role={session?.user?.role ?? "OPERATEUR"}
        onLogout={logoutAction}
        progression={progression}
        nonLues={nonLues}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <CommandPalette />
    </div>
  );
}
