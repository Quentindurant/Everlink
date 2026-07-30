"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "20rem" }}>
        <h1>Everlink</h1>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" required />
        {state.error && <p style={{ color: "red" }}>{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
