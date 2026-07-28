import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Full issuer URL, or bare tenant UUID from Entra app overview. */
function entraIssuerFromEnv(): string | undefined {
  const raw = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("https://")) return raw;
  return `https://login.microsoftonline.com/${raw}/v2.0`;
}

/**
 * Edge-compatible Auth.js config (no Prisma / pg).
 * Middleware must import only this file — see src/middleware.ts.
 */
export const authConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: entraIssuerFromEnv(),
    }),
  ],
  // Required for Edge middleware — Next only inlines statically referenced env.
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    // Other AccessDenied cases (missing oid, provisioning failure, etc.)
    error: "/unauthorized",
  },
  callbacks: {
    /**
     * Middleware gate only. Org/role enrichment lives in auth.ts (Node) and is
     * enforced again via requireActor() on admin pages/APIs.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

      if (!isProtected) {
        return true;
      }

      if (!auth?.user) {
        if (pathname.startsWith("/api/admin")) {
          return Response.json({ error: "Unauthorized." }, { status: 401 });
        }

        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
