"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ClocheNotifications } from "@/components/ClocheNotifications";
import type { NotificationLigne } from "@/lib/repositories/notificationsRepository";

const NAV_GROUPES = [
  {
    titre: "",
    items: [
      { href: "/accueil", label: "Accueil", dot: "var(--ev-blue)" },
      { href: "/clients", label: "Clients", dot: "var(--ev-purple)" },
    ],
  },
  {
    titre: "Migration Téléphone",
    items: [
      { href: "/chef-projet", label: "Chef projet", dot: "var(--ev-purple)" },
      { href: "/telephone", label: "Téléphone", dot: "var(--ev-cyan)" },
    ],
  },
  {
    titre: "ADV",
    items: [{ href: "/techniciens", label: "Pilotage dossiers", dot: "var(--ev-green)" }],
  },
  {
    titre: "Staging",
    items: [{ href: "/staging", label: "Stock & routeurs", dot: "var(--ev-cyan)" }],
  },
  {
    titre: "Management",
    items: [
      { href: "/lots", label: "Lots", dot: "var(--ev-green)" },
      { href: "/import-monday", label: "Import Monday", dot: "var(--ev-blue)" },
      { href: "/provisionning", label: "Provisionning", dot: "var(--ev-blue)" },
      { href: "/import-sda", label: "Export SDA", dot: "var(--ev-amber)" },
      { href: "/import-mac", label: "Export MAC", dot: "var(--ev-amber)" },
    ],
  },
];

function monogram(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.replace(/[^a-zA-Z]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return (
    (parts[0][0] ?? "") + ((parts[1]?.[0] ?? parts[0][1]) ?? "")
  ).toUpperCase();
}

export function AppSidebar({
  email,
  role,
  onLogout,
  badges = {},
  progression,
  notifications = [],
  nonLues = 0,
}: {
  email: string;
  role: string;
  onLogout: () => Promise<void>;
  badges?: Record<string, string | number | undefined>;
  notifications?: NotificationLigne[];
  nonLues?: number;
  progression?: {
    postesFaits: number;
    postesTotal: number;
    pct: number;
    clientsFaits: number;
    clientsTotal: number;
  };
}) {
  const pathname = usePathname();
  const estActif = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const groupes = role === "ADMIN"
    ? [
        ...NAV_GROUPES,
        { titre: "Admin", items: [{ href: "/parametres", label: "Paramètres", dot: "var(--ev-slate)" }] },
      ]
    : NAV_GROUPES;

  return (
    <aside
      className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r"
      style={{
        background: "var(--ev-sidebar-bg)",
        borderColor: "var(--ev-sidebar-border)",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-4 pt-[18px] pb-3.5">
        <Image
          src="/everlink-logo.png"
          alt="EverLink"
          width={155}
          height={24}
          priority
          unoptimized
          className="h-6 w-auto"
        />
        <div className="mt-[7px] text-[10.5px]" style={{ color: "var(--ev-text-tertiary)" }}>
          Migration opérateur · GC Développement
        </div>
      </div>

      {/* ── Navigation (groupée par espace) ── */}
      <nav className="flex-1 overflow-y-auto px-2.5 pt-1 pb-2.5">
        {groupes.map((groupe) => (
          <div key={groupe.titre || "accueil"} className="mb-3">
            {groupe.titre && (
              <div
                className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[.09em]"
                style={{ color: "var(--ev-text-muted)" }}
              >
                {groupe.titre}
              </div>
            )}
            <div className="flex flex-col gap-px">
              {groupe.items.map((item) => {
                const active = estActif(item.href);
                const badge = badges[item.href];
                const isAlert = badge === "!";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] transition-colors",
                      active ? "font-semibold" : "font-normal"
                    )}
                    style={{
                      background: active ? "var(--ev-nav-active-bg)" : "transparent",
                      color: active ? "var(--ev-nav-active-fg)" : "var(--ev-nav-fg)",
                    }}
                    onMouseOver={(e) => {
                      if (!active) e.currentTarget.style.background = "var(--ev-nav-hover)";
                    }}
                    onMouseOut={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ background: item.dot, opacity: active ? 1 : 0.45 }}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge !== undefined && (
                      <span
                        className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        style={{
                          background: isAlert ? "var(--pal-red-bg)" : "var(--pal-gray-bg)",
                          color: isAlert ? "var(--pal-red-fg)" : "var(--pal-gray-fg)",
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Notifications ── */}
      <div className="border-t px-2.5 py-2" style={{ borderColor: "var(--ev-card-border-light)" }}>
        <ClocheNotifications notifications={notifications} nonLues={nonLues} />
      </div>

      {/* ── Widget progression du chantier ── */}
      {progression && (
        <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--ev-card-border-light)" }}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11.5px] font-bold" style={{ color: "var(--ev-body)" }}>
              SEWAN → UNYC
            </span>
            <span
              className="font-mono text-[11.5px] font-bold"
              style={{ color: "var(--ev-accent-text)" }}
            >
              {progression.pct} %
            </span>
          </div>
          <div
            className="mb-1.5 h-[5px] overflow-hidden rounded-full"
            style={{ background: "oklch(0.93 0.008 240)" }}
          >
            <div
              className="h-full rounded-full"
              style={{ background: "var(--ev-blue)", width: `${progression.pct}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between text-[11px]" style={{ color: "var(--ev-text-tertiary)" }}>
            <span>
              {progression.postesFaits} / {progression.postesTotal} postes
            </span>
            <span title="Clients dont tous les postes sont migrés">
              {progression.clientsFaits} / {progression.clientsTotal} clients
            </span>
          </div>
        </div>
      )}

      {/* ── User footer ── */}
      <div
        className="flex items-center gap-2 border-t px-3.5 py-[11px]"
        style={{ borderColor: "var(--ev-card-border-light)" }}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold"
          style={{ background: "var(--ev-nav-active-bg)", color: "var(--ev-nav-active-fg)" }}
        >
          {monogram(email)}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[11.5px] font-semibold"
            style={{ color: "var(--ev-body)" }}
            title={email}
          >
            {email}
          </div>
          <div className="text-[10.5px]" style={{ color: "var(--ev-text-tertiary)" }}>
            {role}
          </div>
        </div>
        <form action={onLogout}>
          <button
            type="submit"
            className="font-mono text-xs transition-colors hover:cursor-pointer"
            style={{ color: "var(--ev-red)" }}
            title="Se déconnecter"
          >
            [&rarr;
          </button>
        </form>
      </div>
    </aside>
  );
}
