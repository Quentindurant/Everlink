import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DOSSIER_GUIDES_SPEEK } from "@/lib/domain/mail/softphone";

// Guides déposés dans public/guides/<dossier>/ : joints tels quels aux mails. Lire le
// dossier à l'envoi évite un redéploiement quand un guide est mis à jour.
export interface PieceJointe {
  filename: string;
  path: string;
}

export async function listerGuides(dossier = DOSSIER_GUIDES_SPEEK): Promise<PieceJointe[]> {
  const racine = join(process.cwd(), "public", "guides", dossier);
  try {
    const fichiers = await readdir(racine);
    return fichiers
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort()
      .map((filename) => ({ filename, path: join(racine, filename) }));
  } catch {
    // Dossier absent (déploiement sans guides) : on envoie le mail sans pièce jointe.
    return [];
  }
}
