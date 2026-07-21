import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Full issuer URL, or bare tenant UUID from Entra app overview. */
function entraIssuerFromEnv(): string | undefined {
  const raw = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("https://")) {
    const base = raw.replace(/\/$/, "");
    return base.endsWith("/v2.0") ? base : `${base}/v2.0`;
  }
  return `https://login.microsoftonline.com/${raw}/v2.0`;
}

/**
 * Lazy config so credentials are read when a request hits Auth.js (not only at
 * module init). Never pass `clientId: undefined` — Auth.js stringifies that
 * into the Microsoft authorize URL as client_id=undefined.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim();
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim();
  const issuer = entraIssuerFromEnv();

  if (!clientId || clientId === "undefined") {
    console.error(
      "[auth] AUTH_MICROSOFT_ENTRA_ID_ID is missing or the literal string 'undefined'.",
      "Check Railway service Variables (not only Shared Variables).",
    );
  }

  return {
    providers: [
      MicrosoftEntraID({
        ...(clientId && clientId !== "undefined" ? { clientId } : {}),
        ...(clientSecret ? { clientSecret } : {}),
        ...(issuer ? { issuer } : {}),
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
  };
});
