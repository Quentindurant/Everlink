import { readFileSync } from "node:fs";
import { join } from "node:path";

// Signature EverLink ajoutée automatiquement à chaque mail envoyé par l'app :
// logo cliquable vers le site + Pôle migration + adresse + site. Le logo part en pièce
// jointe inline (cid) pour s'afficher même quand le client mail bloque les images distantes.

const SITE = "http://www.everlink-services.fr/";
const EMAIL = "migration.ext@everlink-services.fr";
export const CID_LOGO = "logo-everlink";

export const SIGNATURE_TEXTE = `Pôle migration
${EMAIL}
www.everlink-services.fr`;

export function signatureHtml(): string {
  const lien = "color:#0f766e;text-decoration:underline";
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td style="padding-right:18px;vertical-align:middle">
      <a href="${SITE}" target="_blank">
        <img src="cid:${CID_LOGO}" alt="EverLink" width="150" style="display:block;border:0" />
      </a>
    </td>
    <td style="border-left:2px solid #2f6bd8;padding-left:18px;vertical-align:middle">
      <div style="font-size:14px;font-weight:bold;color:#1f2937">Pôle migration</div>
      <div style="font-size:13px;margin-top:6px;color:#1f2937">
        |&nbsp;<a href="mailto:${EMAIL}" style="${lien}">${EMAIL}</a>
      </div>
      <div style="font-size:13px;margin-top:6px;color:#1f2937">
        |&nbsp;<a href="${SITE}" target="_blank" style="${lien}">www.everlink-services.fr</a>
      </div>
    </td>
  </tr>
</table>`;
}

// Corps saisi (texte brut) → HTML sûr, retours à la ligne préservés.
export function corpsEnHtml(texte: string): string {
  const echappe = texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2937">${echappe}</div>`;
}

export function pieceJointeLogo(): { filename: string; content: Buffer; cid: string } | null {
  try {
    return {
      filename: "everlink-logo.png",
      content: readFileSync(join(process.cwd(), "public", "everlink-logo.png")),
      cid: CID_LOGO,
    };
  } catch {
    // Logo introuvable (environnement de test) : la signature part sans image.
    return null;
  }
}
