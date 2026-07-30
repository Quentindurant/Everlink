import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { RoleApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const utilisateur = await prisma.utilisateurApp.findUnique({
          where: { email },
        });
        if (!utilisateur || !utilisateur.actif) return null;

        const valid = await bcrypt.compare(password, utilisateur.motDePasse);
        if (!valid) return null;

        return {
          id: utilisateur.id,
          email: utilisateur.email,
          name: utilisateur.nom,
          role: utilisateur.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as RoleApp;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  // Prisma Compute isn't Vercel/Cloudflare Pages, so Auth.js won't auto-trust the
  // reverse proxy's X-Forwarded-Host — without this, every /api/auth/* route 500s
  // with "UntrustedHost". See https://authjs.dev/getting-started/deployment#self-hosted
  trustHost: true,
});
