import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMikrotikRsc } from "./mikrotik";

// Export réel d'un HAP-AC2 Sewan (docs/), la référence du besoin UNYC.
const rscReel = readFileSync(
  join(import.meta.dir, "../../../docs/MikroTik_HAP-AC2_IP-260713-161878.rsc"),
  "utf8"
);

describe("parseMikrotikRsc — export réel", () => {
  const c = parseMikrotikRsc(rscReel);

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
});
