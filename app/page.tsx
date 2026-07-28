import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  let dbStatus: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Everlink</h1>
      <p>App: ok</p>
      <p>Database: {dbStatus}</p>
    </main>
  );
}
