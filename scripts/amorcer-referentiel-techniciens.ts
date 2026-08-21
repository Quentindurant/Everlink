// Amorçage PONCTUEL du référentiel commun : pousse les techniciens actifs de
// l'annuaire Everlink vers la colonne `nom_tech` du tableau de suivi (leurs
// choices, gérés dans Paramètres → Techniciens terrain). Idempotent : un nom
// déjà présent (casse/espaces/accents ignorés) est sauté. À lancer sur le VPS
// (variables SUIVI_API_* requises) :
//   bun run scripts/amorcer-referentiel-techniciens.ts             # écrit
//   bun run scripts/amorcer-referentiel-techniciens.ts --simulation # liste sans écrire
import { prisma } from "@/lib/prisma";
import { suiviClient } from "@/lib/suivi/suiviClient";
import { CLE_COLONNE_NOM_TECH, estNomPlausible, nomDejaDansChoix } from "@/lib/domain/suivi/referentielTechniciens";

async function main(): Promise<void> {
  const simulation = process.argv.includes("--simulation");
  const client = suiviClient();

  const colonnes = await client.lireColonnes();
  const colonne = colonnes.find((c) => c.key === CLE_COLONNE_NOM_TECH);
  if (!colonne || colonne.type !== "SELECT") {
    throw new Error(`Colonne ${CLE_COLONNE_NOM_TECH} absente ou pas encore SELECT côté tableau.`);
  }

  const labelsExistants = colonne.choices.filter((c) => !c.archived).map((c) => c.label);

  const techniciens = await prisma.technicien.findMany({
    where: { actif: true },
    select: { nom: true },
    orderBy: { nom: "asc" },
  });

  let ajoutes = 0;
  let dejaPresents = 0;
  let ecartes = 0;
  for (const { nom } of techniciens) {
    const propre = nom.trim();
    if (!estNomPlausible(propre)) {
      console.log(`écarté (nom non plausible) : « ${nom} »`);
      ecartes++;
      continue;
    }
    if (nomDejaDansChoix(labelsExistants, propre)) {
      dejaPresents++;
      continue;
    }
    labelsExistants.push(propre);
    if (simulation) {
      console.log(`à ajouter : ${propre}`);
    } else {
      await client.ajouterChoix(colonne.id, propre);
      console.log(`ajouté : ${propre}`);
    }
    ajoutes++;
  }

  console.log(
    `${simulation ? "SIMULATION — " : ""}techniciens actifs : ${techniciens.length}, ` +
      `ajoutés : ${ajoutes}, déjà présents : ${dejaPresents}, écartés : ${ecartes}`,
  );
}

main()
  .catch((e) => {
    console.error("Amorçage interrompu :", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
