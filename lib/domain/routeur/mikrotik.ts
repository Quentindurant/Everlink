// Parseur des exports de configuration MikroTik (.rsc) récupérés sur les routeurs Sewan.
// Extrait ce qu'il faut pour reproduire la configuration côté UNYC : LAN, plage DHCP, DNS,
// WiFi (SSID + clé), redirections NAT/DMZ, WAN (PPPoE, VLAN), accès admin.
// Pur et sans dépendance : testable sur un fichier réel.

export interface WifiExtrait {
  ssid: string;
  bande: string | null; // "2ghz-b/g/n", "5ghz-a/n/ac"
  securite: string | null; // "wpa2-psk"
  cle: string | null;
}

export interface NatExtrait {
  action: string; // "dst-nat" | "masquerade" | …
  protocole: string | null;
  portsEntree: string | null; // dst-port
  versAdresse: string | null; // to-addresses
  versPorts: string | null; // to-ports
  commentaire: string | null;
}

export interface ConfigRouteurExtraite {
  lanAdresse: string | null; // "192.168.0.1/24"
  dhcpPlage: string | null; // "192.168.0.2-192.168.0.254"
  dhcpBailSecondes: number | null;
  passerelle: string | null;
  dnsServeurs: string[];
  wifi: WifiExtrait[];
  nat: NatExtrait[];
  dmz: string | null; // adresse cible d'une redirection totale, si présente
  wanType: string | null; // "pppoe"
  wanUtilisateur: string | null;
  wanVlanId: string | null;
  adminMotDePasse: string | null;
}

// Recolle les continuations de ligne ("\" en fin de ligne, style RouterOS).
function lignesRecollees(texte: string): string[] {
  const brutes = texte.split(/\r?\n/);
  const out: string[] = [];
  let courante = "";
  for (const b of brutes) {
    const l = b.trim();
    if (courante) {
      courante += " " + l;
    } else {
      courante = l;
    }
    if (courante.endsWith("\\")) {
      courante = courante.slice(0, -1).trim();
      continue;
    }
    if (courante) out.push(courante);
    courante = "";
  }
  if (courante) out.push(courante);
  return out;
}

// Extrait les paires clé=valeur d'une commande (valeurs entre guillemets acceptées).
function attributs(ligne: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w-]+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ligne)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1");
  }
  return out;
}

export function parseMikrotikRsc(texte: string): ConfigRouteurExtraite {
  const config: ConfigRouteurExtraite = {
    lanAdresse: null,
    dhcpPlage: null,
    dhcpBailSecondes: null,
    passerelle: null,
    dnsServeurs: [],
    wifi: [],
    nat: [],
    dmz: null,
    wanType: null,
    wanUtilisateur: null,
    wanVlanId: null,
    adminMotDePasse: null,
  };

  let contexte = "";
  for (const ligne of lignesRecollees(texte)) {
    if (ligne.startsWith("#") || ligne.startsWith(":")) continue;

    let commande = ligne;
    if (ligne.startsWith("/")) {
      // "/ip pool" seul = changement de contexte ; "/ip pool add …" = contexte + commande.
      const m = ligne.match(/^(\/[a-z][\w\s-]*?)(?:\s+(add|set)\b(.*))?$/i);
      if (m) {
        contexte = m[1].trim();
        if (!m[2]) continue;
        commande = `${m[2]}${m[3] ?? ""}`;
      }
    }
    const verbe = commande.split(/\s+/)[0];
    if (verbe !== "add" && verbe !== "set") continue;
    const a = attributs(commande);

    if (contexte === "/ip address" && a.address && !config.lanAdresse) {
      config.lanAdresse = a.address;
    } else if (contexte === "/ip pool" && a.ranges) {
      config.dhcpPlage = a.ranges;
    } else if (contexte === "/ip dhcp-server" && a["lease-time"]) {
      const brut = a["lease-time"];
      const n = Number(brut);
      config.dhcpBailSecondes = Number.isFinite(n) ? n : null;
    } else if (contexte === "/ip dhcp-server network") {
      if (a.gateway) config.passerelle = a.gateway;
      if (a["dns-server"]) config.dnsServeurs = a["dns-server"].split(",");
    } else if (contexte === "/ip dns" && a.servers && config.dnsServeurs.length === 0) {
      config.dnsServeurs = a.servers.split(",");
    } else if (contexte === "/interface wireless security-profiles") {
      // La clé s'applique aux SSID déclarés ensuite ; on la garde de côté.
      if (a["wpa2-pre-shared-key"]) {
        for (const w of config.wifi) if (!w.cle) w.cle = a["wpa2-pre-shared-key"];
        config.wifi.push; // no-op lisible
        (config as ConfigRouteurExtraite & { _cle?: string; _secu?: string })._cle =
          a["wpa2-pre-shared-key"];
      }
      if (a["authentication-types"]) {
        (config as ConfigRouteurExtraite & { _secu?: string })._secu = a["authentication-types"];
      }
    } else if (contexte === "/interface wireless" && a.ssid) {
      const etendu = config as ConfigRouteurExtraite & { _cle?: string; _secu?: string };
      config.wifi.push({
        ssid: a.ssid,
        bande: a.band ?? null,
        securite: etendu._secu ?? null,
        cle: etendu._cle ?? null,
      });
    } else if (contexte === "/ip firewall nat") {
      const nat: NatExtrait = {
        action: a.action ?? "?",
        protocole: a.protocol ?? null,
        portsEntree: a["dst-port"] ?? null,
        versAdresse: a["to-addresses"] ?? null,
        versPorts: a["to-ports"] ?? null,
        commentaire: a.comment ?? null,
      };
      config.nat.push(nat);
      // DMZ : redirection dst-nat sans restriction de port vers une adresse interne.
      if (nat.action === "dst-nat" && nat.versAdresse && !nat.portsEntree) {
        config.dmz = nat.versAdresse;
      }
    } else if (contexte === "/interface pppoe-client") {
      config.wanType = "pppoe";
      if (a.user) config.wanUtilisateur = a.user;
    } else if (contexte === "/interface vlan" && a["vlan-id"]) {
      config.wanVlanId = a["vlan-id"];
    } else if (contexte === "/user" && a.password) {
      config.adminMotDePasse = a.password;
    }
  }

  // Nettoyage des champs de travail internes.
  delete (config as ConfigRouteurExtraite & { _cle?: string })._cle;
  delete (config as ConfigRouteurExtraite & { _secu?: string })._secu;
  return config;
}
