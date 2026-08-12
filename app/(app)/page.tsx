import { redirect } from "next/navigation";

// La racine ouvre le poste de travail quotidien : la migration poste par poste. Le
// provisionnement (saisie et correction des numéros/MAC) reste sur /provisionning, où
// renvoient la fiche client et le menu Management.
export default function AccueilRedirection() {
  redirect("/telephone");
}
