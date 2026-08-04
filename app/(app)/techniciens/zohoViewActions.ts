"use server";

import { auth } from "@/auth";
import { lireLignesSheet, type LigneZoho } from "@/lib/zoho/zohoClient";

export async function rafraichirZohoAction(): Promise<{
  configure: boolean;
  onglet: string;
  lignes: LigneZoho[];
}> {
  const session = await auth();
  if (!session?.user) return { configure: false, onglet: "", lignes: [] };
  const { onglet, lignes } = await lireLignesSheet();
  return { configure: lignes.length > 0 || !!process.env.ZOHO_REFRESH_TOKEN, onglet, lignes };
}
