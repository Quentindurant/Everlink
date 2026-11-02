import { readFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

// Signature ajoutée automatiquement à chaque mail envoyé par l'app, au nom du partenaire du
// dossier : logo cliquable vers le site, Pôle migration, lignes libres (raison sociale,
// adresse), boîte migration, site. Le logo part en pièce jointe inline (cid) pour s'afficher
// même quand le client mail bloque les images distantes.

export interface SignatureMail {
  /** Nom du partenaire, texte alternatif du logo. */
  nom: string;
  /** Chemin du logo sous public/ ("/everlink-logo.png"). Vide = signature sans image. */
  logo: string | null;
  /** URL complète du site. */
  site: string | null;
  /** Boîte de l'équipe migration. */
  email: string | null;
  /** Lignes affichées entre « Pôle migration » et l'adresse mail, une par ligne. */
  lignes: string | null;
}

// Signature des envois sans partenaire (alertes internes) : celle d'avant le multi-partenaire.
export const SIGNATURE_EVERLINK: SignatureMail = {
  nom: "EverLink",
  logo: "/everlink-logo.png",
  site: "http://www.everlink-services.fr/",
  email: "migration.ext@everlink-services.fr",
  lignes: null,
};

export function signatureDepuisPartenaire(p: {
  nom: string;
  logo: string;
  site: string | null;
  mailMigration: string | null;
  signatureLignes: string | null;
}): SignatureMail {
  return { nom: p.nom, logo: p.logo, site: p.site, email: p.mailMigration, lignes: p.signatureLignes };
}

/** « https://www.inovacom.fr/ » devient « www.inovacom.fr ». */
export function siteAffiche(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function lignesLibres(s: SignatureMail): string[] {
  return (s.lignes ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Identifiant cid du logo, propre à chaque partenaire. */
export function cidLogo(s: SignatureMail): string {
  return `logo-${s.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function signatureTexte(s: SignatureMail): string {
  const site = s.site?.trim() ? siteAffiche(s.site) : "";
  return ["Pôle migration", ...lignesLibres(s), s.email?.trim() ?? "", site].filter(Boolean).join("\n");
}

export function signatureHtml(s: SignatureMail, avecLogo: boolean): string {
  const lien = "color:#0f766e;text-decoration:underline";
  const ligne = "font-size:13px;margin-top:6px;color:#1f2937";
  const site = s.site?.trim() ? s.site.trim() : null;
  const email = s.email?.trim() ? s.email.trim() : null;

  const image = `<img src="cid:${cidLogo(s)}" alt="${echapper(s.nom)}" width="150" style="display:block;border:0" />`;
  const celluleLogo = avecLogo
    ? `
    <td style="padding-right:18px;vertical-align:middle">
      ${site ? `<a href="${echapper(site)}" target="_blank">${image}</a>` : image}
    </td>`
    : "";

  const libres = lignesLibres(s)
    .map((l) => `\n      <div style="${ligne}">${echapper(l)}</div>`)
    .join("");
  const ligneEmail = email
    ? `\n      <div style="${ligne}">\n        |&nbsp;<a href="mailto:${echapper(email)}" style="${lien}">${echapper(email)}</a>\n      </div>`
    : "";
  const ligneSite = site
    ? `\n      <div style="${ligne}">\n        |&nbsp;<a href="${echapper(site)}" target="_blank" style="${lien}">${echapper(siteAffiche(site))}</a>\n      </div>`
    : "";

  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;font-family:Arial,Helvetica,sans-serif">
  <tr>${celluleLogo}
    <td style="${avecLogo ? "border-left:2px solid #2f6bd8;padding-left:18px;" : ""}vertical-align:middle">
      <div style="font-size:14px;font-weight:bold;color:#1f2937">Pôle migration</div>${libres}${ligneEmail}${ligneSite}
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

export function pieceJointeLogo(
  s: SignatureMail
): { filename: string; content: Buffer; cid: string } | null {
  if (!s.logo?.trim()) return null;
  // Le chemin vient de la base : on refuse tout ce qui sortirait de public/.
  const racine = resolve(process.cwd(), "public");
  const chemin = resolve(join(racine, s.logo.trim()));
  if (!chemin.startsWith(racine + sep)) return null;
  try {
    return { filename: basename(chemin), content: readFileSync(chemin), cid: cidLogo(s) };
  } catch {
    // Logo introuvable (environnement de test) : la signature part sans image.
    return null;
  }
}
