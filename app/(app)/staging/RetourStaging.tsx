import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Lien de retour au portail staging, en tête de chaque page d'étape.
export function RetourStaging() {
  return (
    <Link
      href="/staging"
      className="inline-flex w-fit items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      style={{ borderColor: "var(--ev-card-border)" }}
    >
      <ArrowLeft className="size-3.5" />
      Staging
    </Link>
  );
}
