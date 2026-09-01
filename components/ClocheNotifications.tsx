"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationLigne } from "@/lib/repositories/notificationsRepository";
import {
  chargerNotificationsAction,
  marquerNotificationLueAction,
  marquerToutesNotificationsLuesAction,
} from "@/app/(app)/notificationsActions";

// Cloche de la barre latérale : les non lues d'abord, un clic ouvre le dossier concerné et
// marque l'alerte comme lue. Les techniciens n'ouvrent pas les fiches tous les jours, c'est
// ici qu'ils apprennent qu'un prestataire les attend.
export function ClocheNotifications({ nonLues }: { nonLues: number }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [notifications, setNotifications] = useState<NotificationLigne[] | null>(null);
  const [, startTransition] = useTransition();

  // La liste n'arrive qu'à l'ouverture : la barre latérale ne paie que le compteur.
  const basculer = () => {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain && notifications === null) {
      startTransition(async () => {
        setNotifications(await chargerNotificationsAction());
      });
    }
  };

  const ouvrir = (n: NotificationLigne) => {
    startTransition(async () => {
      if (!n.lu) await marquerNotificationLueAction(n.id);
      if (n.lien) router.push(n.lien);
      setOuvert(false);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={basculer}
        className="relative flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[13px] hover:bg-[var(--ev-nav-hover)]"
        style={{ color: "var(--ev-nav-fg)" }}
        title="Notifications"
      >
        <Bell className="size-4" />
        <span className="flex-1 text-left">Notifications</span>
        {nonLues > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ background: "var(--pal-red-bg)", color: "var(--pal-red-fg)" }}
          >
            {nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          {/* Clic à l'extérieur : referme le volet sans rien marquer comme lu. */}
          <button
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOuvert(false)}
            aria-label="Fermer les notifications"
          />
          <div
            className="absolute bottom-full left-0 z-50 mb-1 max-h-96 w-[320px] overflow-auto rounded-xl border bg-white shadow-lg"
            style={{ borderColor: "var(--ev-card-border)" }}
          >
            <div
              className="flex items-center justify-between border-b px-3 py-2"
              style={{ borderColor: "var(--ev-card-border-light)" }}
            >
              <span className="text-[12.5px] font-bold">Notifications</span>
              {nonLues > 0 && (
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await marquerToutesNotificationsLuesAction();
                      setNotifications(await chargerNotificationsAction());
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:underline"
                >
                  <Check className="size-3" />
                  tout marquer lu
                </button>
              )}
            </div>

            {notifications === null ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">Chargement…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                Aucune notification.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => ouvrir(n)}
                  className={cn(
                    "block w-full border-t px-3 py-2 text-left transition-colors hover:bg-[var(--ev-row-hover)]",
                    !n.lu && "bg-[var(--pal-blue-bg)]/40"
                  )}
                  style={{ borderColor: "var(--ev-row-border)" }}
                >
                  <div className="flex items-start gap-1.5">
                    {!n.lu && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--pal-red-dot,var(--ev-red))]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[12.5px]", !n.lu && "font-semibold")}>
                        {n.titre}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {n.message}
                      </span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        {new Date(n.creeLe).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
