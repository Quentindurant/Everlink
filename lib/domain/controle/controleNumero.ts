export type NiveauControle = "OK" | "AVERTISSEMENT" | "ERREUR";

export interface NumeroPourControle {
  numeroNormalise: string;
  utilisateurId: string | null;
  numerosCourts: string[];
  aEquipement?: boolean;
}

export interface ContexteControle {
  numerosNormalisesActifs: string[];
  numerosCourtsDuClient: string[];
}

export interface ResultatControle {
  niveau: NiveauControle;
  detail: string | null;
}

const SEVERITE: Record<NiveauControle, number> = { OK: 0, AVERTISSEMENT: 1, ERREUR: 2 };

export function evaluerControle(
  numero: NumeroPourControle,
  contexte: ContexteControle
): ResultatControle {
  const anomalies: Array<{ niveau: NiveauControle; message: string }> = [];

  if (!/^\d{10}$/.test(numero.numeroNormalise)) {
    anomalies.push({ niveau: "ERREUR", message: "Le numéro ne fait pas 10 chiffres." });
  } else if (!numero.numeroNormalise.startsWith("0")) {
    anomalies.push({ niveau: "ERREUR", message: "Le numéro ne commence pas par 0." });
  } else {
    const prefixe = numero.numeroNormalise.slice(0, 2);
    if (["06", "07", "08"].includes(prefixe)) {
      anomalies.push({
        niveau: "AVERTISSEMENT",
        message: `Le préfixe ${prefixe} n'est pas géographique.`,
      });
    }
  }

  // Une ligne vierge (numéro non saisi) n'est pas le doublon d'une autre ligne vierge: plusieurs
  // lignes fraîchement ajoutées coexistent légitimement. L'ERREUR "10 chiffres" ci-dessus couvre
  // déjà le cas, inutile d'y ajouter un faux doublon.
  if (numero.numeroNormalise !== "") {
    const occurrences = contexte.numerosNormalisesActifs.filter(
      (n) => n === numero.numeroNormalise
    ).length;
    if (occurrences > 1) {
      anomalies.push({
        niveau: "ERREUR",
        message: "Ce numéro est en doublon sur les lots actifs.",
      });
    }
  }

  if (numero.utilisateurId && numero.aEquipement === false) {
    anomalies.push({
      niveau: "AVERTISSEMENT",
      message: "Incohérence: un utilisateur est renseigné sans équipement.",
    });
  }

  if (!numero.utilisateurId && numero.aEquipement === true) {
    anomalies.push({
      niveau: "AVERTISSEMENT",
      message: "Incohérence: un équipement est renseigné sans utilisateur.",
    });
  }

  for (const court of numero.numerosCourts) {
    const occurrencesCourt = contexte.numerosCourtsDuClient.filter((c) => c === court).length;
    if (occurrencesCourt > 1) {
      anomalies.push({
        niveau: "AVERTISSEMENT",
        message: `Le numéro court ${court} est en doublon pour ce client.`,
      });
    }
  }

  if (anomalies.length === 0) {
    return { niveau: "OK", detail: null };
  }

  const niveau = anomalies.reduce<NiveauControle>(
    (max, a) => (SEVERITE[a.niveau] > SEVERITE[max] ? a.niveau : max),
    "OK"
  );
  return { niveau, detail: anomalies.map((a) => a.message).join(" ") };
}
