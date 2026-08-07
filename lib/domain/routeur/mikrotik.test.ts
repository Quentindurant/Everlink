import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDureeRouterOS, parseMikrotikRsc } from "./mikrotik";

// Export réel d'un HAP-AC2 Sewan. Volontairement non versionné (il contient la clé WiFi et
// le mot de passe admin d'un client) : la suite ne tourne que si le fichier est présent.
const cheminReel = join(import.meta.dir, "../../../docs/MikroTik_HAP-AC2_IP-260713-161878.rsc");
const rscReel = existsSync(cheminReel) ? readFileSync(cheminReel, "utf8") : null;

describe.if(rscReel !== null)("parseMikrotikRsc — export réel", () => {
  // describe.if n'empêche pas l'exécution de ce callback : parse conditionnel obligatoire.
  const c = parseMikrotikRsc(rscReel ?? "");

  test("LAN et passerelle", () => {
    expect(c.lanAdresse).toBe("192.168.0.1/24");
    expect(c.passerelle).toBe("192.168.0.1");
  });

  test("plage DHCP et bail", () => {
    expect(c.dhcpPlage).toBe("192.168.0.2-192.168.0.254");
    expect(c.dhcpBailSecondes).toBe(86400);
  });

  test("DNS du réseau DHCP", () => {
    expect(c.dnsServeurs).toEqual(["185.48.254.18", "85.14.174.253"]);
  });

  test("WiFi : deux bandes, même SSID, clé WPA2 extraite", () => {
    expect(c.wifi).toHaveLength(2);
    expect(c.wifi[0].ssid).toBe("LaforetAntonyMarche");
    expect(c.wifi[0].cle).toBe("Antonymarche2023");
    expect(c.wifi.map((w) => w.bande)).toEqual(["2ghz-b/g/n", "5ghz-a/n/ac"]);
  });

  test("NAT : masquerade présent, pas de DMZ ici", () => {
    expect(c.nat.some((n) => n.action === "masquerade")).toBe(true);
    expect(c.dmz).toBeNull();
  });

  test("WAN PPPoE + VLAN", () => {
    expect(c.wanType).toBe("pppoe");
    expect(c.wanUtilisateur).toBe("ip260713161878@fibre.srvc.bytel.dop");
    expect(c.wanVlanId).toBe("4001");
  });

  test("mot de passe admin", () => {
    expect(c.adminMotDePasse).toBe("S0l@rstr@t0s");
  });
});

// Second format réel : autoprov Sewan officiel (CPE filaire, "do { … }", deux comptes).
const cheminAutoprov = join(import.meta.dir, "../../../docs/F6500F9E1BEE");
const rscAutoprov = existsSync(cheminAutoprov) ? readFileSync(cheminAutoprov, "utf8") : null;

describe.if(rscAutoprov !== null)("parseMikrotikRsc — autoprov Sewan (F6500F9E1BEE)", () => {
  const c = parseMikrotikRsc(rscAutoprov ?? "");

  test("identité du CPE", () => {
    expect(c.identite).toBe("ADNSFR_6810423");
  });

  test("LAN, plage DHCP, bail au format 1d", () => {
    expect(c.lanAdresse).toBe("172.16.10.254/24");
    expect(c.dhcpPlage).toBe("172.16.10.10-172.16.10.200");
    expect(c.dhcpBailSecondes).toBe(86400);
    expect(c.passerelle).toBe("172.16.10.254");
  });

  test("NAT : quatre redirections IPBX en to-port + masquerade", () => {
    const redirections = c.nat.filter((n) => n.action === "dst-nat");
    expect(redirections).toHaveLength(4);
    expect(redirections[0].versAdresse).toBe("172.16.10.199");
    expect(redirections[0].versPorts).toBe("4500");
    expect(c.nat.some((n) => n.action === "masquerade")).toBe(true);
  });

  test("comptes : everpass ET admin, le bon mot de passe admin", () => {
    expect(c.comptes.map((x) => x.nom).sort()).toEqual(["admin", "everpass"]);
    expect(c.adminMotDePasse).toBe("4J1wFg4MVD");
  });

  test("WAN PPPoE + VLAN 2900, pas de WiFi sur ce CPE", () => {
    expect(c.wanUtilisateur).toBe("sw-SXR9CBNA@sw.dop");
    expect(c.wanVlanId).toBe("2900");
    expect(c.wifi).toEqual([]);
  });
});

describe("parseDureeRouterOS", () => {
  test("formats usuels", () => {
    expect(parseDureeRouterOS("86400")).toBe(86400);
    expect(parseDureeRouterOS("1d")).toBe(86400);
    expect(parseDureeRouterOS("24h")).toBe(86400);
    expect(parseDureeRouterOS("1h30m")).toBe(5400);
    expect(parseDureeRouterOS("n'importe quoi")).toBeNull();
  });
});

describe("parseMikrotikRsc — cas synthétiques", () => {
  test("redirection de port et DMZ", () => {
    const rsc = `
/ip firewall nat
add action=dst-nat chain=dstnat comment="Camera" dst-port=8080 protocol=tcp to-addresses=192.168.0.50 to-ports=80
add action=dst-nat chain=dstnat comment="DMZ serveur" to-addresses=192.168.0.100
`;
    const c = parseMikrotikRsc(rsc);
    expect(c.nat).toHaveLength(2);
    expect(c.nat[0].portsEntree).toBe("8080");
    expect(c.nat[0].versAdresse).toBe("192.168.0.50");
    expect(c.dmz).toBe("192.168.0.100");
  });

  test("continuations de ligne recollées", () => {
    const rsc = "/ip pool\nadd name=p \\\nranges=10.0.0.10-10.0.0.99";
    expect(parseMikrotikRsc(rsc).dhcpPlage).toBe("10.0.0.10-10.0.0.99");
  });

  test("fichier vide → tout à null, rien ne casse", () => {
    const c = parseMikrotikRsc("");
    expect(c.lanAdresse).toBeNull();
    expect(c.wifi).toEqual([]);
  });

  test("IP publique du lien via le certificat HTTPS du CPE", () => {
    const rsc = `
/certificate
add name=unyc_cert common-name=unyc_cert key-usage=key-cert-sign,crl-sign
add name=cert_unyc common-name=2.59.147.49
`;
    expect(parseMikrotikRsc(rsc).ipPubliqueAncienne).toBe("2.59.147.49");
  });
});
