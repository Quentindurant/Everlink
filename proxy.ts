import { auth } from "@/auth";

export const proxy = auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  // Exclusions ancrées sur le segment: sans le "/" final, une route comme /apidocs ou
  // /_next/staticky échapperait au contrôle d'authentification.
  matcher: ["/((?!api/|_next/static/|_next/image/|favicon.ico).*)"],
};
