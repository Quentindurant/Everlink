import { prisma } from "@/lib/prisma";

export interface LotLigne {
  id: string;
  nom: string;
  reference: string | null;
  description: string | null;
  clos: boolean;
  nbClients: number;
  nbNumeros: number;
  nbBasculesFaites: number;
}

export async function fetchLots(): Promise<LotLigne[]> {
  const lots = await prisma.lot.findMany({
    include: {
      clients: {
        where: { archiveA: null },
        include: { numeros: { where: { archiveA: null }, select: { statutBascule: true } } },
      },
    },
    orderBy: { nom: "asc" },
  });

  return lots.map((lot) => {
    const numeros = lot.clients.flatMap((c) => c.numeros);
    return {
      id: lot.id,
      nom: lot.nom,
      reference: lot.reference,
      description: lot.description,
      clos: lot.clos,
      nbClients: lot.clients.length,
      nbNumeros: numeros.length,
      nbBasculesFaites: numeros.filter((n) => n.statutBascule === "Fait").length,
    };
  });
}

export async function creerLot(nom: string, reference: string | null): Promise<void> {
  await prisma.lot.create({ data: { nom, reference: reference || null } });
}

export async function updateLot(
  id: string,
  data: { nom?: string; reference?: string | null; clos?: boolean }
): Promise<void> {
  await prisma.lot.update({ where: { id }, data });
}
