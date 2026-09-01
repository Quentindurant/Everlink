"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  fetchNotifications,
  marquerLue,
  marquerToutesLues,
  type NotificationLigne,
} from "@/lib/repositories/notificationsRepository";

// La liste n'est chargée qu'à l'ouverture de la cloche : la barre latérale se contente du
// compteur de non-lues, une requête au lieu de deux sur chaque page affichée.
export async function chargerNotificationsAction(): Promise<NotificationLigne[]> {
  const session = await auth();
  if (!session?.user?.email) return [];
  return fetchNotifications(session.user.email);
}

export async function marquerNotificationLueAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;
  await marquerLue(id, session.user.email);
  revalidatePath("/", "layout");
}

export async function marquerToutesNotificationsLuesAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;
  await marquerToutesLues(session.user.email);
  revalidatePath("/", "layout");
}
