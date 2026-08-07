"use client";

import { CopiePuce } from "@/components/CopiePuce";
import type { ConfigRouteurExtraite, NatExtrait } from "@/lib/domain/routeur/mikrotik";

// Présentation calquée sur les écrans de gestion routeur UNYC (WAN → LAN → NAT → DMZ) :
// mêmes sections, mêmes libellés, mêmes découpages de champs. Le technicien recopie de
// gauche (ici) à droite (UNYC) dans l'ordre, chaque valeur copiable en un clic.

function Champ({ etiquette, valeur }: { etiquette: string; valeur: string | null }) {
  if (!valeur) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiquette}
      </span>
      <CopiePuce valeur={valeur} titre={etiquette} />
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--ev-card-border)" }}>
      <div
        className="mb-2 border-b pb-1.5 text-[11px] font-bold uppercase tracking-wide"
        style={{ borderColor: "var(--ev-card-border-light)", color: "var(--ev-accent-text)" }}
      >
        {titre}
      </div>
      {children}
    </div>
  );
}

// Fusionne les règles NAT jumelles (mêmes ports et cible, protocoles tcp/udp séparés)
// comme UNYC les saisit : un seul formulaire "TCP + UDP".
function reglesNatFusionnees(nat: NatExtrait[]) {
  const redirections = nat.filter((n) => n.action === "dst-nat" && n.portsEntree);
  const parCle = new Map<string, { regle: NatExtrait; protocoles: Set<string> }>();
  for (const r of redirections) {
    const cle = `${r.portsEntree}|${r.versAdresse}|${r.versPorts}`;
    const existant = parCle.get(cle);
    if (existant) {
      if (r.protocole) existant.protocoles.add(r.protocole);
    } else {
      parCle.set(cle, { regle: r, protocoles: new Set(r.protocole ? [r.protocole] : []) });
    }
  }
  return [...parCle.values()].map(({ regle, protocoles }) => ({
    ...regle,
    protocoleLabel:
      protocoles.size === 2 ? "TCP + UDP" : (protocoles.values().next().value ?? "TCP + UDP").toUpperCase(),
  }));
}

export function VueUnyc({ d }: { d: ConfigRouteurExtraite }) {
  const [lanIp, lanMasque] = (d.lanAdresse ?? "").split("/");
  const [plageDebut, plageFin] = (d.dhcpPlage ?? "").split("-");
  const [dnsPrimaire, dnsSecondaire] = d.dnsServeurs;
  const nat = reglesNatFusionnees(d.nat);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* WAN — écran "Configuration WANs" */}
      {(d.wanType || d.wanVlanId || d.wanUtilisateur) && (
        <Section titre="WAN">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {d.wanType && <Champ etiquette="Type de connexion" valeur={d.wanType.toUpperCase()} />}
            <Champ etiquette="ID VLAN WAN" valeur={d.wanVlanId} />
            <Champ etiquette="Identifiant PPPoE" valeur={d.wanUtilisateur} />
          </div>
        </Section>
      )}

      {/* LAN — écran "Configuration LANs" (Réseau puis Options IPv4) */}
      <Section titre="LAN — Réseau · Options IPv4">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Champ etiquette="Adresse IP" valeur={lanIp || null} />
          <Champ etiquette="Masque de sous-réseau" valeur={lanMasque ? `/${lanMasque}` : null} />
          <Champ etiquette="DNS primaire" valeur={dnsPrimaire ?? null} />
          <Champ etiquette="DNS secondaire" valeur={dnsSecondaire ?? null} />
          <Champ
            etiquette="Durée du bail"
            valeur={d.dhcpBailSecondes ? String(d.dhcpBailSecondes) : null}
          />
          <Champ etiquette="Adresse IP de départ" valeur={plageDebut || null} />
          <Champ etiquette="Adresse IP de fin" valeur={plageFin || null} />
        </div>
        {d.dhcpBailSecondes && (
          <div className="mt-1.5 text-[10.5px] text-muted-foreground">
            bail en secondes ({Math.round(d.dhcpBailSecondes / 3600)} h) · DHCP serveur activé
          </div>
        )}
      </Section>

      {/* WiFi — pas d'équivalent UNYC direct, mais le tech en a besoin pour les bornes */}
      {d.wifi.length > 0 && (
        <Section titre="WiFi">
          {d.wifi.map((w, i) => (
            <div key={i} className="mb-2 flex flex-wrap gap-x-5 gap-y-2 last:mb-0">
              <Champ etiquette={`SSID ${w.bande ?? ""}`} valeur={w.ssid} />
              <Champ etiquette="Clé WiFi" valeur={w.cle} />
              {w.securite && (
                <span className="self-end text-[10.5px] text-muted-foreground">{w.securite}</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* NAT — modal UNYC "Ajouter une règle de NAT" */}
      {nat.length > 0 && (
        <Section titre="NAT — Règles à recréer">
          {nat.map((n, i) => (
            <div
              key={i}
              className="mb-2 rounded-md border border-dashed p-2 last:mb-0"
              style={{ borderColor: "var(--ev-card-border)" }}
            >
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Champ etiquette="Nom" valeur={n.commentaire ?? `Règle ${i + 1}`} />
                <Champ etiquette="Protocole" valeur={n.protocoleLabel} />
                <Champ etiquette="Port public" valeur={n.portsEntree} />
                <Champ etiquette="IP privée" valeur={n.versAdresse} />
                <Champ etiquette="Port privé" valeur={n.versPorts ?? n.portsEntree} />
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* DMZ */}
      {d.dmz && (
        <Section titre="DMZ">
          <Champ etiquette="IP privée exposée" valeur={d.dmz} />
        </Section>
      )}

      {/* Accès à l'ancien routeur, pour vérification */}
      {(d.comptes ?? []).length > 0 && (
        <Section titre="Accès ancien routeur (Sewan)">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(d.comptes ?? []).map((c) => (
              <Champ key={c.nom} etiquette={`Mot de passe ${c.nom}`} valeur={c.motDePasse} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
