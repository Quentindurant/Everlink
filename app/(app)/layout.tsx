import { auth } from "@/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <div className="flex min-h-screen" style={{ background: "var(--ev-surface)" }}>
      <AppSidebar
        email={session?.user?.email ?? ""}
        role={session?.user?.role ?? "OPERATEUR"}
        onLogout={logoutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
