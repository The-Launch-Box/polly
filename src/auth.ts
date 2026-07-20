import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Full issuer URL, or bare tenant UUID from Entra app overview. */
function entraIssuerFromEnv(): string | undefined {
  // Bracket access avoids Next.js build-time inlining of missing env vars.
  const raw = process.env["AUTH_MICROSOFT_ENTRA_ID_ISSUER"]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("https://")) {
    const base = raw.replace(/\/$/, "");
    return base.endsWith("/v2.0") ? base : `${base}/v2.0`;
  }
  return `https://login.microsoftonline.com/${raw}/v2.0`;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  // Lazy config + bracket access so Railway runtime env is read per request,
  // not frozen as `undefined` during `next build` inside Docker.
  const clientId = process.env["AUTH_MICROSOFT_ENTRA_ID_ID"]?.trim();
  const clientSecret = process.env["AUTH_MICROSOFT_ENTRA_ID_SECRET"]?.trim();

  if (!clientId || !clientSecret) {
    console.error(
      "[auth] Missing Microsoft Entra credentials.",
      `AUTH_MICROSOFT_ENTRA_ID_ID set: ${Boolean(clientId)};`,
      `AUTH_MICROSOFT_ENTRA_ID_SECRET set: ${Boolean(clientSecret)}.`,
      "In Railway, confirm these appear on the web service Variables tab (shared vars must be linked to that service).",
    );
  }

  return {
    providers: [
      MicrosoftEntraID({
        clientId,
        clientSecret,
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
  };
});
