"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { marquerLue, marquerToutesLues } from "@/lib/repositories/notificationsRepository";

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
