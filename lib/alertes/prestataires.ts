import { prisma } from "@/lib/prisma";
import { doitAlerterChefProjet, estPrestataireTraite } from "@/lib/domain/prestataires/statuts";
import { normaliserNomTech } from "@/lib/domain/technicien/disponibilite";
import {
  creerNotifications,
  emailsParRole,
  notificationRecenteExiste,
} from "@/lib/repositories/notificationsRepository";
import { envoyerMail } from "@/lib/mail/mailer";
import { envoyerSms } from "@/lib/notifications/sms";

export interface AlertePrestatairesResultat {
  succes: boolean;
  dossiersEnAlerte: number;
  notifications: number;
  smsEnvoyes: number;
  mailsEnvoyes: number;
  sansChefProjet: string[];
  erreurs: string[];
}

// Prévient le chef de projet quand l'intervention approche (J-3) et qu'un prestataire externe
// du client n'a toujours pas été joint : le jour J, un prestataire absent bloque la migration.
// Trois canaux : notification dans l'app, mail, et SMS sur le téléphone professionnel dès que
// le canal SMS est configuré. Idempotent — une même alerte ne repart pas plusieurs fois par
// jour, même si le cron tourne toutes les deux heures.
export async function runAlertePrestataires(
  maintenant = new Date()
): Promise<AlertePrestatairesResultat> {
  const res: AlertePrestatairesResultat = {
    succes: true,
    dossiersEnAlerte: 0,
    notifications: 0,
    smsEnvoyes: 0,
    mailsEnvoyes: 0,
    sansChefProjet: [],
    erreurs: [],
  };

  const clients = await prisma.client.findMany({
    where: {
      archiveA: null,
      telephoneBloque: false,
      dateIntervention: { not: null },
      prestataires: { some: {} },
    },
    select: {
      id: true,
      raisonSociale: true,
      dateIntervention: true,
      chefProjetNom: true,
      prestataires: { select: { statutContact: true, societe: true, metier: true } },
    },
  });

  const chefs = await prisma.chefProjet.findMany({ where: { actif: true } });
  const chefParNom = new Map(chefs.map((c) => [normaliserNomTech(c.nom), c]));

  for (const c of clients) {
    const statuts = c.prestataires.map((p) => p.statutContact);
    if (!doitAlerterChefProjet(c.dateIntervention, statuts, maintenant)) continue;
    res.dossiersEnAlerte++;

    // Déjà alerté aujourd'hui : on ne renvoie rien (le cron passe plusieurs fois par jour).
    if (await notificationRecenteExiste(c.id, "PRESTATAIRE_NON_CONTACTE")) continue;

    const enAttente = c.prestataires.filter((p) => !estPrestataireTraite(p.statutContact));
    const liste = enAttente.map((p) => `${p.metier} · ${p.societe}`).join(", ");
    const dateFr = c.dateIntervention!.toLocaleDateString("fr-FR");
    const titre = `Prestataire non contacté — ${c.raisonSociale}`;
    const message = `Intervention le ${dateFr}. Reste à joindre : ${liste}`;

    // 1. Dans l'app, pour toute l'équipe : c'est visible sans rien configurer.
    res.notifications += await creerNotifications({
      destinataires: await emailsParRole("TOUS"),
      type: "PRESTATAIRE_NON_CONTACTE",
      titre,
      message,
      lien: `/clients/${c.id}`,
      clientId: c.id,
    });

    // 2. Le chef de projet nommément, sur ses canaux directs.
    const chef = c.chefProjetNom ? chefParNom.get(normaliserNomTech(c.chefProjetNom)) : undefined;
    if (!chef) {
      // Sans chef de projet identifié, l'alerte reste dans l'app : personne à joindre.
      res.sansChefProjet.push(`${c.raisonSociale}${c.chefProjetNom ? ` (${c.chefProjetNom})` : ""}`);
      continue;
    }

    const texte = `EverLink — ${c.raisonSociale} : intervention le ${dateFr}, prestataire non contacté (${liste}).`;
    const sms = await envoyerSms(chef.telephone, texte);
    if (sms.success) res.smsEnvoyes++;
    else if (!sms.nonConfigure) res.erreurs.push(`SMS ${chef.nom} : ${sms.error}`);

    if (chef.email) {
      const mail = await envoyerMail({
        to: chef.email,
        subject: titre,
        text: `${message}\n\nFiche du client : ${process.env.APP_URL ?? ""}/clients/${c.id}`,
      });
      if (mail.success) res.mailsEnvoyes++;
      else res.erreurs.push(`Mail ${chef.nom} : ${mail.error}`);
    }
  }

  res.succes = res.erreurs.length === 0;
  return res;
}
