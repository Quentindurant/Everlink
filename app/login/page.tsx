"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="mb-2">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Everlink
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Connexion</h1>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </main>
  );
}
