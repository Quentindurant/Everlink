-- Nouveaux modèles de mail fournis par le métier : les six combinaisons scénario × type.
-- Remplacement volontaire du texte existant (UPDATE, pas INSERT conditionnel) : c'est la
-- nouvelle rédaction validée qui fait foi, y compris sur les modèles déjà retouchés.
--
-- Deux variables neuves apparaissent : {mail_migration}, la boîte de la filiale à qui le
-- client répond, et {contact_site}, l'interlocuteur présent le jour J.

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Évolution de vos services téléphonie et internet', "corps" = 'Bonjour {civilite_nom},

Dans le cadre de l''amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l''infrastructure technique qui assure vos services de téléphonie (Centrex) et d''accès internet (fibre).

Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance. Il s''agit d''une opération simple et rapide, qui n''aura pas d''impact sur votre activité.

Ce que cela implique pour vous :
- Aucun changement de vos numéros de téléphone
- Aucuns travaux : seul votre routeur sera remplacé. Vos téléphones actuels ne sont pas changés.
- Une intervention sur votre site sera nécessaire. Celle-ci sera planifiée avec vous en amont afin d''installer un nouveau routeur, de procéder à la bascule de votre accès Internet et de reconfigurer vos téléphones.
- Si vous utilisez actuellement le softphone DOKO sur votre PC ou votre mobile, celui-ci sera remplacé par notre nouveau softphone Speek, plus simple d''utilisation et plus intuitif.

Vos prestataires tiers : si certains de vos équipements sont connectés à votre accès Internet et gérés par des prestataires externes (alarme, vidéosurveillance, contrôle d''accès, pare-feu, etc.), nous vous remercions de préparer la liste de ces prestataires ainsi que leurs coordonnées.
Ces informations seront recueillies lors de notre prochain appel de planification. Nous ne les contacterons que si des adaptations techniques de leur côté sont nécessaires pour assurer le bon déroulement de l''intervention.

Notre équipe vous contactera très prochainement afin de convenir d''une date d''intervention.
Pour toute question, vous pouvez contacter notre équipe à l''adresse {mail_migration}

Nous vous remercions pour votre confiance et restons à votre disposition.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex + FTTH — sur site' AND "type" = 'PREVENANCE';

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Confirmation de votre rendez-vous — Migration de vos services {nom_client}', "corps" = 'Bonjour {civilite_nom},

Comme convenu lors de notre échange, nous vous confirmons la planification de l''intervention nécessaire à la migration de vos services de téléphonie et Internet. Il s''agit d''une opération simple : un seul rendez-vous, réunissant l''intervention de l''opérateur et celle du technicien.

Rendez-vous avec l''opérateur et le technicien — livraison du lien et bascule des équipements (durée 4h)
Date : {date}  |  Créneau : {creneau}
Lieu d''intervention : {adresse}
Contact sur site : {contact_site}

Prérequis à préparer avant l''intervention :
- Accès libre au local technique / à la baie où sont installés vos équipements actuels
- Accès libre au local technique où arrive la fibre (point de livraison FTTH)
- Présence d''une personne habilitée sur site pendant toute la durée du rendez-vous

Si vous utilisez le softphone sur votre PC et/ou votre mobile :
- Merci d''installer dès à présent le nouveau softphone Speek, via ce lien : https://speekapp.io/telechargement/ (ou directement depuis le store de votre mobile).
- Droits d''installation : si des droits administrateurs sont nécessaires, merci de vous rapprocher de votre support informatique en amont.
- Jour de l''intervention : nous recommandons la présence des utilisateurs concernés afin de faciliter la mise en place. En cas d''indisponibilité, un accompagnement à distance pourra être organisé — merci de nous communiquer leurs coordonnées (nom et téléphone/email) à l''avance.

Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d''intervention, à {mail_migration} ou au {numero_gc}.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex + FTTH — sur site' AND "type" = 'CONFIRMATION';

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Évolution de votre service de téléphonie', "corps" = 'Bonjour {civilite_nom},

Dans le cadre de l''amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l''infrastructure technique qui assure votre service de téléphonie (Centrex).

Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance.

Ce que cela implique pour vous :
- Aucun changement de vos numéros de téléphone
- Aucuns travaux : seul votre routeur sera remplacé. Vos téléphones actuels ne sont pas changés.
- Une intervention sur votre site sera nécessaire. Celle-ci sera planifiée avec vous en amont afin d''installer un nouveau routeur et de reconfigurer vos téléphones.
- Si vous utilisez actuellement le softphone DOKO sur votre PC ou votre mobile, celui-ci sera remplacé par notre nouveau softphone Speek, plus simple d''utilisation et plus intuitif.

Notre équipe vous contactera très prochainement afin de convenir d''une date d''intervention.
Pour toute question, vous pouvez contacter notre équipe à l''adresse {mail_migration}

Nous vous remercions pour votre confiance et restons à votre disposition.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex — sur site (sans FTTH)' AND "type" = 'PREVENANCE';

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Confirmation de votre rendez-vous — Migration de votre téléphonie {nom_client}', "corps" = 'Bonjour {civilite_nom},

Comme convenu lors de notre échange, nous vous confirmons la planification de l''intervention nécessaire à la migration de votre service de téléphonie.

Rendez-vous technicien — bascule de votre ligne téléphonique (durée 2h)
Date : {date}  |  Créneau : {creneau}
Lieu d''intervention : {adresse}
Contact sur site : {contact_site}

Prérequis à préparer avant l''intervention :
- Accès libre à l''emplacement de vos équipements téléphoniques actuels
- Présence d''une personne habilitée sur site pendant toute la durée du rendez-vous

Si vous utilisez le softphone sur votre PC et/ou votre mobile :
- Merci d''installer dès à présent le nouveau softphone Speek, via ce lien : https://speekapp.io/telechargement/ (ou directement depuis le store de votre mobile).
- Droits d''installation : si des droits administrateurs sont nécessaires, merci de vous rapprocher de votre support informatique en amont.
- Jour de l''intervention : nous recommandons la présence des utilisateurs concernés afin de faciliter la mise en place. En cas d''indisponibilité, un accompagnement à distance pourra être organisé — merci de nous communiquer leurs coordonnées (nom et téléphone/email) à l''avance.

Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d''intervention, à {mail_migration} ou au {numero_gc}.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex — sur site (sans FTTH)' AND "type" = 'CONFIRMATION';

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Évolution de votre service de téléphonie', "corps" = 'Bonjour {civilite_nom},

Dans le cadre de l''amélioration continue de la qualité de service que nous souhaitons vous apporter, Everlink Services fait évoluer l''infrastructure technique qui assure votre service de téléphonie (Centrex).

Cette modernisation a pour objectif de vous offrir une meilleure expérience au quotidien : davantage de stabilité et de performance. Pour votre confort, cette migration pourra être réalisée entièrement à distance, sans déplacement sur site.

Ce que cela implique pour vous :
- Aucun changement de vos numéros de téléphone
- Aucuns travaux : aucune intervention physique sur vos installations n''est nécessaire.
- La migration sera effectuée à distance par nos équipes techniques. La présence d''un interlocuteur sur site sera toutefois requise le jour de l''intervention afin d''accompagner la reconfiguration des téléphones.

Notre équipe vous contactera très prochainement afin de convenir d''une date et de confirmer le contact technique présent sur site le jour de l''opération.
Pour toute question, vous pouvez contacter notre commercial à l''adresse {mail_migration}

Nous vous remercions pour votre confiance et restons à votre disposition.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex — à distance' AND "type" = 'PREVENANCE';

UPDATE "ModeleMail" SET "objet" = '[EVERLINK - IMPORTANT] - Confirmation de votre rendez-vous — Migration à distance de votre téléphonie {nom_client}', "corps" = 'Bonjour {civilite_nom},

Comme convenu lors de notre échange, nous vous confirmons la planification de la migration à distance de votre service de téléphonie.

Rendez-vous technique à distance
Date : {date}  |  Créneau : {creneau}
Contact technique présent sur site : {contact_site}

Prérequis à préparer avant l''intervention :
- Présence sur site, durant le créneau indiqué, d''une personne pouvant manipuler les postes téléphoniques (redémarrage, branchement)
- Accès aux postes téléphoniques et, si nécessaire, à leurs câbles d''alimentation et réseau
- Disponibilité téléphonique du contact sur site pour être guidé en direct par notre technicien
- Maintien de votre connexion internet actuelle en état de fonctionnement

Ce rendez-vous mobilise nos équipes techniques. Toute demande de report devra nous parvenir au minimum 72h avant la date d''intervention, à {mail_migration} ou au {numero_gc}.

Cordialement,

Pôle migration — Everlink Services
{mail_migration} | www.everlink-services.fr', "majLe" = now()
WHERE "scenario" = 'Centrex — à distance' AND "type" = 'CONFIRMATION';

-- Boîte mail de migration de la filiale, éditable dans Paramètres. Initialisée à l'adresse
-- déjà utilisée en copie de chaque envoi : c'est la même boîte.
INSERT INTO "ParametreApp" ("cle", "valeur", "majLe")
SELECT 'mailMigration', COALESCE((SELECT "valeur" FROM "ParametreApp" WHERE "cle" = 'copieMail'), '')
     , now()
WHERE NOT EXISTS (SELECT 1 FROM "ParametreApp" WHERE "cle" = 'mailMigration');
