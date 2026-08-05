// Répare les équipements importés avant le fix "postes multiples par user" (9743ca9) :
// à l'époque, un utilisateur à deux postes créait UN équipement dont le libellé de modèle
// contenait toute la cellule Sewan ("Yealink W59R (0291EE3BBA - YEALINK), Yealink T53")
// avec une seule MAC. Ce script re-parse ces libellés, réassigne l'équipement existant au
// premier poste réel et crée les postes manquants avec leur identifiant.
//
// Dry-run par défaut (affiche le plan sans écrire). Pour appliquer :
//   DATABASE_URL=... bun run scripts/repare-equipements-concatenes.ts --apply
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { extraireEquipements } from "@/lib/domain/import/sewanUsers";
import { normaliserMac } from "@/lib/domain/normalisation";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const APPLY = process.argv.includes("--apply");

async function resoudreModele(libelle: string, cache: Map<string, string>): Promise<string> {
  const cle = libelle.toLowerCase();
  const enCache = cache.get(cle);
  if (enCache) return enCache;
  const existants = await prisma.modeleEquipement.findMany();
  const trouve = existants.find(
    (m) => m.libelle.toLowerCase() === cle || m.alias.some((a) => a.toLowerCase() === cle)
  );
  if (trouve) {
    cache.set(cle, trouve.id);
    return trouve.id;
  }
  const marque = libelle.trim().split(/\s+/)[0] || libelle;
  const cree = await prisma.modeleEquipement.create({
    data: { libelle, marque, eligibleExport: marque.toLowerCase() === "yealink", alias: [] },
  });
  console.log(`  + modèle créé : ${libelle}`);
  cache.set(cle, cree.id);
  return cree.id;
}

async function main() {
  // Un libellé sain ne contient ni parenthèse (identifiant) ni virgule (concaténation).
  const modelesSales = await prisma.modeleEquipement.findMany({
    where: { OR: [{ libelle: { contains: "(" } }, { libelle: { contains: "," } }] },
  });
  if (modelesSales.length === 0) {
    console.log("Aucun modèle concaténé. Rien à faire.");
    return;
  }
  console.log(`${modelesSales.length} modèle(s) au libellé concaténé :`);
  const cacheModele = new Map<string, string>();
  let equipsRepares = 0;
  let equipsCrees = 0;

  for (const modele of modelesSales) {
    const postes = extraireEquipements(modele.libelle);
    if (postes.length === 0) continue;
    console.log(`\n"${modele.libelle}" → ${postes.map((p) => p.modele).join(" + ")}`);

    const equipements = await prisma.equipement.findMany({
      where: { modeleId: modele.id, archiveA: null },
    });

    for (const equip of equipements) {
      // La MAC déjà stockée revient au premier poste sans identifiant dans le libellé ;
      // les identifiants entre parenthèses appartiennent à leur poste.
      const macExistanteNorm = equip.macNormalise;
      const macs = postes.map((p) => p.mac);
      const dejaConnue = macs.some((m) => m && normaliserMac(m) === macExistanteNorm);
      let macExistanteAttribuee = dejaConnue || !equip.macBrut;

      for (const [i, poste] of postes.entries()) {
        let macBrut = poste.mac ?? "";
        if (!macBrut && !macExistanteAttribuee) {
          macBrut = equip.macBrut;
          macExistanteAttribuee = true;
        }
        const macNormalise = normaliserMac(macBrut);

        if (i === 0) {
          console.log(`  ~ équipement ${equip.id} → ${poste.modele} (${macBrut || "sans MAC"})`);
          if (APPLY) {
            const modeleId = await resoudreModele(poste.modele, cacheModele);
            await prisma.equipement.update({
              where: { id: equip.id },
              data: { modeleId, macBrut, macNormalise },
            });
          }
          equipsRepares++;
        } else {
          // Idempotent : ne crée pas un poste dont la MAC existe déjà chez ce client.
          if (macNormalise) {
            const doublon = await prisma.equipement.findFirst({
              where: { clientId: equip.clientId, macNormalise, archiveA: null },
            });
            if (doublon && doublon.id !== equip.id) {
              console.log(`  = ${poste.modele} (${macBrut}) déjà présent, ignoré`);
              continue;
            }
          }
          console.log(`  + nouveau poste ${poste.modele} (${macBrut || "sans MAC"})`);
          if (APPLY) {
            const modeleId = await resoudreModele(poste.modele, cacheModele);
            await prisma.equipement.create({
              data: {
                clientId: equip.clientId,
                utilisateurId: equip.utilisateurId,
                modeleId,
                macBrut,
                macNormalise,
                ordre: i,
              },
            });
          }
          equipsCrees++;
        }
      }
    }
  }

  console.log(
    `\n${APPLY ? "Appliqué" : "Dry-run (rien écrit, relancer avec --apply)"} : ` +
      `${equipsRepares} équipement(s) réassigné(s), ${equipsCrees} poste(s) créé(s).`
  );
}

main().finally(() => prisma.$disconnect());
