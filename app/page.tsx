import { fetchProvisionningLignes } from "@/lib/repositories/provisionningRepository";
import { ProvisionningTable } from "@/app/provisionning/ProvisionningTable";

export const dynamic = "force-dynamic";

export default async function ProvisionningPage() {
  const lignes = await fetchProvisionningLignes();
  return (
    <main style={{ padding: "1rem" }}>
      <h1>Provisionning</h1>
      <ProvisionningTable lignes={lignes} />
    </main>
  );
}
