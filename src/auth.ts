import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Full issuer URL, or bare tenant UUID from Entra app overview. */
function entraIssuerFromEnv(): string | undefined {
  const raw = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("https://")) return raw;
  return `https://login.microsoftonline.com/${raw}/v2.0`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: entraIssuerFromEnv(),
    }),
  ],
  trustHost: true,
  callbacks: {
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
});
