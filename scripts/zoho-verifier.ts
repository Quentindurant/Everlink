// Vérifie que la connexion au Zoho Sheet fonctionne : authentification, onglet lu, lignes
// EVERLINK trouvées, et noms de techniciens absents de l'annuaire. À lancer après avoir
// changé le ZOHO_REFRESH_TOKEN, ou quand la synchronisation semble muette.
//
//   bun run scripts/zoho-verifier.ts
//
// Lecture seule : aucune écriture dans le Sheet ni en base.

import { lireLignesSheet } from "../lib/zoho/zohoClient";
import { prisma } from "../lib/prisma";
import { normaliserNomTech } from "../lib/domain/technicien/disponibilite";

async function main() {
  const { onglet, lignes } = await lireLignesSheet();
  console.log(`Onglet lu       : ${onglet}`);
  console.log(`Lignes EVERLINK : ${lignes.length}`);

  if (lignes.length === 0) {
    console.log(
      "\nAucune ligne. Causes possibles :\n" +
        "  - ZOHO_REFRESH_TOKEN révoqué (regénérer : bun run scripts/zoho-token.ts <code>)\n" +
        `  - l'onglet « ${onglet} » n'existe pas encore dans le classeur\n` +
        "  - aucune ligne n'a EVERLINK dans la colonne PARTE"
    );
    return;
  }

  const noms = [...new Set(lignes.map((l) => l.nomTech.trim()).filter(Boolean))];
  const techs = await prisma.technicien.findMany({ select: { nom: true } });
  const connus = new Set(techs.map((t) => normaliserNomTech(t.nom)));
  const inconnus = noms.filter((n) => !connus.has(normaliserNomTech(n)));

  console.log(`Techniciens cités : ${noms.length}`);
  if (inconnus.length > 0) {
    console.log(`Absents de l'annuaire (${inconnus.length}) : ${inconnus.join(", ")}`);
    console.log("Ils seront créés au prochain passage du cron zoho-pull.");
  } else {
    console.log("Tous les techniciens du Sheet sont connus de l'annuaire.");
  }
}

main().finally(() => prisma.$disconnect());
