"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/accueil",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Identifiants invalides." };
    }
    throw err;
  }
}
