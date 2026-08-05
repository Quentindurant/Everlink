"use client";

// Modal d'import en 3 étapes du design system v2 : overlay sombre, carte 620px,
// header titre + étape + fermeture. Le contenu des étapes est fourni par l'appelant.
export function ImportModal({
  open,
  onClose,
  titre,
  etapeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titre: string;
  etapeLabel: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0.2 0.02 240 / 0.45)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[620px] overflow-auto rounded-[14px] bg-white"
        style={{ boxShadow: "0 24px 60px oklch(0.2 0.02 240 / 0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--ev-card-border-light)" }}
        >
          <div>
            <div className="text-sm font-bold">{titre}</div>
            <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ev-text-tertiary)" }}>
              {etapeLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm hover:cursor-pointer"
            style={{ color: "var(--ev-body-muted)" }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
