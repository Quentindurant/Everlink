"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopiePuce } from "@/components/CopiePuce";
import type { ConfigRouteurExtraite } from "@/lib/domain/routeur/mikrotik";
import type { ConfigRouteurLigne } from "@/lib/repositories/stockRepository";
import { importerConfigRouteurAction, supprimerConfigRouteurAction } from "../actions";

// Import du .rsc + affichage par client des infos à reproduire côté UNYC.
export function ConfigRouteurStaging({
  configs,
  clients,
}: {
  configs: ConfigRouteurLigne[];
  clients: { id: string; raisonSociale: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const idListe = "clients-config-routeur";

  const importer = (formData: FormData) => {
    setErreur(null);
    startTransition(async () => {
      const r = await importerConfigRouteurAction(formData);
      if (r.success) {
        formRef.current?.reset();
        router.refresh();
      } else setErreur(r.error ?? "Échec de l'import.");
    });
  };

  return (
    <div>
      <datalist id={idListe}>
        {clients.map((c) => (
          <option key={c.id} value={c.raisonSociale} />
        ))}
      </datalist>

      {/* Import */}
      <form ref={formRef} action={importer} className="flex flex-wrap items-center gap-2 px-4 py-3">
        <input
          type="file"
          name="fichier"
          accept=".rsc,text/plain"
          required
          className="text-sm file:mr-3 file:rounded-[7px] file:border-0 file:bg-primary file:px-3.5 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
        <Input list={idListe} name="client" placeholder="client…" className="h-9 w-56 text-sm" />
        <Button type="submit" disabled={isPending}>
          <Upload data-icon="inline-start" />
          {isPending ? "Analyse…" : "Importer"}
        </Button>
        {erreur && <span className="text-sm text-destructive">{erreur}</span>}
      </form>

      {/* Configurations importées */}
      {configs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune configuration importée.
        </p>
      ) : (
        <div className="flex flex-col">
          {configs.map((c) => {
            const d = c.donnees as ConfigRouteurExtraite;
            return (
              <div
                key={c.id}
                className="border-t px-4 py-3 first:border-t-0"
                style={{ borderColor: "var(--ev-card-border-light)" }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-bold">{c.clientNom ?? "— client non renseigné —"}</span>
                  {d.identite && (
                    <span className="ev-badge bg-[var(--pal-violet-bg)] text-[color:var(--pal-violet-fg)]">
                      {d.identite}
                    </span>
                  )}
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {c.nomFichier} · {new Date(c.creeLe).toLocaleDateString("fr-FR")}
                  </span>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await supprimerConfigRouteurAction(c.id);
                        router.refresh();
                      })
                    }
                    className="ml-auto rounded-lg border p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer cette configuration"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {/* LAN / DHCP */}
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--ev-card-border)" }}>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ev-th)" }}>
                      LAN · DHCP
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.lanAdresse && <CopiePuce valeur={d.lanAdresse} titre="IP routeur / réseau" />}
                      {d.dhcpPlage && <CopiePuce valeur={d.dhcpPlage} titre="Plage DHCP" />}
                      {d.passerelle && <CopiePuce valeur={d.passerelle} titre="Passerelle" />}
                      {d.dnsServeurs.map((s) => (
                        <CopiePuce key={s} valeur={s} titre="DNS" />
                      ))}
                    </div>
                    {d.dhcpBailSecondes && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        bail {Math.round(d.dhcpBailSecondes / 3600)} h
                      </div>
                    )}
                  </div>

                  {/* WiFi */}
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--ev-card-border)" }}>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ev-th)" }}>
                      WiFi
                    </div>
                    {d.wifi.length === 0 ? (
                      <span className="text-xs text-muted-foreground">aucun</span>
                    ) : (
                      d.wifi.map((w, i) => (
                        <div key={i} className="mb-1 flex flex-wrap items-center gap-1">
                          <CopiePuce valeur={w.ssid} titre="SSID" />
                          {w.cle && <CopiePuce valeur={w.cle} titre="Clé WiFi" />}
                          <span className="text-[10.5px] text-muted-foreground">
                            {w.bande ?? ""} {w.securite ? `· ${w.securite}` : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* NAT / DMZ */}
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--ev-card-border)" }}>
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ev-th)" }}>
                      NAT · DMZ
                    </div>
                    {d.dmz && (
                      <div className="mb-1 flex items-center gap-1">
                        <span className="ev-badge bg-[var(--pal-red-bg)] text-[color:var(--pal-red-fg)]">DMZ</span>
                        <CopiePuce valeur={d.dmz} titre="Adresse DMZ" />
                      </div>
                    )}
                    {(() => {
                      const redirections = d.nat.filter((n) => n.action === "dst-nat" && n.portsEntree);
                      if (redirections.length === 0 && !d.dmz) {
                        return <span className="text-xs text-muted-foreground">aucune redirection</span>;
                      }
                      return redirections.map((n, i) => (
                        <div key={i} className="mb-1 flex flex-wrap items-center gap-1 text-[11px]">
                          <CopiePuce valeur={`${n.portsEntree}`} titre={`Port entrant${n.protocole ? ` (${n.protocole})` : ""}`} />
                          <span className="text-muted-foreground">→</span>
                          <CopiePuce
                            valeur={`${n.versAdresse ?? "?"}${n.versPorts ? `:${n.versPorts}` : ""}`}
                            titre="Destination interne"
                          />
                          {n.commentaire && <span className="text-muted-foreground">{n.commentaire}</span>}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Accès & WAN, discret */}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  {d.wanType && <span>WAN {d.wanType.toUpperCase()}{d.wanVlanId ? ` · VLAN ${d.wanVlanId}` : ""}</span>}
                  {d.wanUtilisateur && <CopiePuce valeur={d.wanUtilisateur} titre="Identifiant PPPoE" />}
                  {(d.comptes ?? []).map((cpt) => (
                    <span key={cpt.nom} className="inline-flex items-center gap-1">
                      <span>· {cpt.nom}</span>
                      <CopiePuce valeur={cpt.motDePasse} titre={`Mot de passe ${cpt.nom}`} />
                    </span>
                  ))}
                  {(d.comptes ?? []).length === 0 && d.adminMotDePasse && (
                    <>
                      <span>· admin</span>
                      <CopiePuce valeur={d.adminMotDePasse} titre="Mot de passe admin routeur" />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
