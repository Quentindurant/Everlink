import { fetchLots } from "@/lib/repositories/lotsRepository";
import { LotsTable } from "./LotsTable";

export const dynamic = "force-dynamic";

export default async function LotsPage() {
  const lots = await fetchLots();
  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Everlink
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Lots</h1>
      </header>
      <LotsTable lots={lots} />
    </main>
  );
}
