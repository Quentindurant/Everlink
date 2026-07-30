import { RoleApp } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: RoleApp;
    } & DefaultSession["user"];
  }

  interface User {
    role: RoleApp;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleApp;
  }
}
