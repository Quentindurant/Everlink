"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSpreadsheet,
  FileUp,
  Hash,
  Layers,
  LogOut,
  Phone,
  Settings,
  Table2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LIENS = [
  { href: "/", label: "Provisionning", icone: Table2 },
  { href: "/clients", label: "Clients", icone: Users },
  { href: "/telephone", label: "Téléphone", icone: Phone },
  { href: "/lots", label: "Lots", icone: Layers },
  { href: "/import-sda", label: "Import SDA", icone: Hash },
  { href: "/import-mac", label: "Import MAC", icone: FileSpreadsheet },
  { href: "/import-monday", label: "Import Monday", icone: FileUp },
];

export function AppSidebar({
  email,
  role,
  onLogout,
}: {
  email: string;
  role: string;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const estActif = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const liens = role === "ADMIN"
    ? [...LIENS, { href: "/parametres", label: "Paramètres", icone: Settings }]
    : LIENS;

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      <div className="px-4 py-5">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <p className="text-sm font-semibold">Bascule SEWAN → UNYC</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {liens.map((lien) => {
          const Icone = lien.icone;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                estActif(lien.href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icone className="size-4" />
              {lien.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <p className="truncate px-1 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <form action={onLogout}>
          <Button variant="ghost" size="sm" type="submit" className="mt-1 w-full justify-start">
            <LogOut data-icon="inline-start" />
            Se déconnecter
          </Button>
        </form>
      </div>
    </aside>
  );
}
