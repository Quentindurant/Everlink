import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { filtrePartenaire, idPartenaireActif } from "@/lib/partenaire";

export const dynamic = "force-dynamic";

// Recherche globale (palette Cmd+K): clients, utilisateurs, numéros, MAC, articles stock.
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ resultats: [] });

  const insensible = { contains: q, mode: "insensitive" as const };
  // La recherche globale ne traverse pas les périmètres : elle est le raccourci le plus
  // rapide vers un dossier, ce serait la première fuite d\'un partenaire vers l\'autre.
  const fp = filtrePartenaire(await idPartenaireActif());
  const [clients, utilisateurs, numeros, equipements, articles] = await Promise.all([
    prisma.client.findMany({
      where: { archiveA: null, raisonSociale: insensible, ...fp },
      select: { id: true, raisonSociale: true },
      take: 5,
    }),
    prisma.utilisateur.findMany({
      where: { archiveA: null, nom: insensible, client: { archiveA: null, ...fp } },
      select: { id: true, nom: true, clientId: true, client: { select: { raisonSociale: true } } },
      take: 5,
    }),
    prisma.numero.findMany({
      where: {
        archiveA: null,
        numeroNormalise: { contains: q.replace(/\D/g, "") || q },
        client: { ...fp },
      },
      select: { numeroBrut: true, clientId: true, client: { select: { raisonSociale: true } } },
      take: 5,
    }),
    prisma.equipement.findMany({
      where: {
        archiveA: null,
        macNormalise: { contains: q.replace(/[\s.:\-]/g, "").toUpperCase() },
        client: { ...fp },
      },
      select: { macBrut: true, clientId: true, client: { select: { raisonSociale: true } } },
      take: 5,
    }),
    prisma.articleStock.findMany({
      where: { archiveA: null, numeroSerie: insensible, ...fp },
      select: { numeroSerie: true, type: true },
      take: 5,
    }),
  ]);

  const resultats = [
    ...clients.map((c) => ({ type: "Client", libelle: c.raisonSociale, detail: "", href: `/clients/${c.id}` })),
    ...utilisateurs.map((u) => ({ type: "Utilisateur", libelle: u.nom, detail: u.client.raisonSociale, href: `/clients/${u.clientId}` })),
    ...numeros.map((n) => ({ type: "Numéro", libelle: n.numeroBrut, detail: n.client.raisonSociale, href: `/clients/${n.clientId}` })),
    ...equipements.map((e) => ({ type: "MAC", libelle: e.macBrut, detail: e.client.raisonSociale, href: `/clients/${e.clientId}` })),
    ...articles.map((a) => ({ type: "Stock", libelle: a.numeroSerie, detail: a.type, href: "/staging" })),
  ];
  return NextResponse.json({ resultats });
}
