"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Provisionning", dot: "#1f6bff" },
  { href: "/clients", label: "Clients", dot: "#8a5bff" },
  { href: "/telephone", label: "Téléphone", dot: "#00b8cc" },
  { href: "/techniciens", label: "Techniciens", dot: "#16b57f" },
  { href: "/lots", label: "Lots", dot: "#16b57f" },
  { href: "/import-sda", label: "Import SDA", dot: "#ffb020" },
  { href: "/import-mac", label: "Import MAC", dot: "#ffb020" },
  { href: "/import-monday", label: "Import Monday", dot: "#1f6bff" },
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
}: {
  email: string;
  role: string;
  onLogout: () => Promise<void>;
  badges?: Record<string, string | number | undefined>;
  progression?: { faites: number; total: number; pct: number };
}) {
  const pathname = usePathname();
  const estActif = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items = role === "ADMIN"
    ? [...NAV_ITEMS, { href: "/parametres", label: "Paramètres", dot: "#7a8699" }]
    : NAV_ITEMS;

  return (
    <aside
      className="sticky top-0 flex h-screen w-[262px] shrink-0 flex-col"
      style={{
        background: "var(--ev-navy)",
        padding: "20px 14px 16px",
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-1.5">
        <span
          className="grid size-[38px] shrink-0 place-items-center rounded-xl font-mono text-[13px] font-bold"
          style={{
            background: "var(--ev-blue)",
            color: "#fff",
            letterSpacing: "-0.02em",
          }}
        >
          GC
        </span>
        <div>
          <div
            className="text-[15px] font-[800] tracking-[.06em]"
            style={{ color: "#fff" }}
          >
            EVERLINK
          </div>
          <div
            className="mt-0.5 font-mono text-[9px] tracking-[.14em]"
            style={{ color: "var(--ev-text-muted)" }}
          >
            GC DEVELOPPEMENT
          </div>
        </div>
      </div>

      {/* ── Widget Chantier en cours ── */}
      <div
        className="mt-4.5 rounded-2xl border p-3.5"
        style={{
          background: "var(--ev-navy-light)",
          borderColor: "var(--ev-navy-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[9px] tracking-[.14em]"
            style={{ color: "var(--ev-text-tertiary)" }}
          >
            CHANTIER EN COURS
          </span>
          <span
            className="ev-pulse size-1.5 rounded-full"
            style={{ background: "var(--ev-green)" }}
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-white">
          SEWAN{" "}
          <span className="font-mono" style={{ color: "var(--ev-cyan)" }}>
            &rarr;
          </span>{" "}
          UNYC
        </div>
        {progression && (
          <>
            <div className="mt-3 h-[7px] overflow-hidden rounded-sm" style={{ background: "var(--ev-navy-border)" }}>
              <div
                className="h-full rounded-sm"
                style={{ background: "var(--ev-blue)", width: `${progression.pct}%` }}
              />
            </div>
            <div
              className="mt-2 font-mono text-[10px]"
              style={{ color: "var(--ev-text-tertiary)" }}
            >
              {progression.faites} / {progression.total} basculés &middot; {progression.pct}%
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="mt-4 flex flex-col gap-0.5">
        {items.map((item) => {
          const active = estActif(item.href);
          const badge = badges[item.href];
          const isAlert = badge === "!";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm transition-colors",
                active ? "font-bold" : "font-medium"
              )}
              style={{
                background: active ? "var(--ev-navy-active)" : "transparent",
                color: active ? "#fff" : "#93a6c2",
                boxShadow: active ? `inset 3px 0 0 ${item.dot}` : "none",
              }}
              onMouseOver={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--ev-navy-hover)";
                  e.currentTarget.style.color = "#fff";
                }
              }}
              onMouseOut={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#93a6c2";
                }
              }}
            >
              <span
                className="size-[9px] shrink-0 rounded-sm"
                style={{
                  background: item.dot,
                  opacity: active ? 1 : 0.55,
                }}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {badge !== undefined && (
                <span
                  className="rounded-[7px] px-1.5 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    background: isAlert ? "var(--ev-red)" : "var(--ev-navy-border)",
                    color: isAlert ? "#fff" : "#8ba0bf",
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div
        className="mt-auto border-t pt-3.5"
        style={{ borderColor: "#1a2740" }}
      >
        <div className="flex items-center gap-2 px-1">
          <span
            className="grid size-[26px] shrink-0 place-items-center rounded-[9px] font-mono text-[10px] font-semibold"
            style={{
              background: "var(--ev-navy-border)",
              color: "#9fb4d4",
            }}
          >
            {monogram(email)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-xs"
              style={{ color: "#cddaeb" }}
              title={email}
            >
              {email}
            </div>
          </div>
          <form action={onLogout}>
            <button
              type="submit"
              className="font-mono text-xs transition-colors hover:cursor-pointer"
              style={{ color: "var(--ev-red)" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#ff6b60")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--ev-red)")}
              title="Se déconnecter"
            >
              [&rarr;
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
