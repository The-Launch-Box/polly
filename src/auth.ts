import { readFileSync } from "node:fs";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Read env in a way Next.js cannot replace at build time.
 * Falls back to /proc/self/environ (Linux containers) if process.env is wrong.
 */
function runtimeEnv(name: string): string | undefined {
  try {
    const fromProcess = process.env[name]?.trim();
    if (fromProcess) return fromProcess;
  } catch {
    /* ignore */
  }

  try {
    const raw = readFileSync("/proc/self/environ", "utf8");
    for (const entry of raw.split("\0")) {
      const i = entry.indexOf("=");
      if (i === -1) continue;
      if (entry.slice(0, i) === name) {
        const value = entry.slice(i + 1).trim();
        return value || undefined;
      }
    }
  } catch {
    /* not Linux / no access */
  }

  return undefined;
}

/** Full issuer URL, or bare tenant UUID from Entra app overview. */
function entraIssuerFromEnv(): string | undefined {
  const raw = runtimeEnv("AUTH_MICROSOFT_ENTRA_ID_ISSUER");
  if (!raw) return undefined;
  if (raw.startsWith("https://")) {
    const base = raw.replace(/\/$/, "");
    return base.endsWith("/v2.0") ? base : `${base}/v2.0`;
  }
  return `https://login.microsoftonline.com/${raw}/v2.0`;
}

function entraCredentials() {
  const clientId = runtimeEnv("AUTH_MICROSOFT_ENTRA_ID_ID");
  const clientSecret = runtimeEnv("AUTH_MICROSOFT_ENTRA_ID_SECRET");
  const issuer = entraIssuerFromEnv();

  if (!clientId || clientId === "undefined" || !clientSecret) {
    const authKeys = Object.keys(process.env)
      .filter((k) => /AUTH|MICROSOFT|ENTRA/i.test(k))
      .sort();
    console.error("[auth] Entra credentials missing at runtime.", {
      hasClientId: Boolean(clientId) && clientId !== "undefined",
      hasClientSecret: Boolean(clientSecret),
      hasIssuer: Boolean(issuer),
      authRelatedEnvKeys: authKeys,
    });
  }

  return { clientId, clientSecret, issuer };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const { clientId, clientSecret, issuer } = entraCredentials();

  // Only pass defined values — never `clientId: undefined` (Auth.js stringifies that
  // into the Microsoft authorize URL as client_id=undefined).
  const provider = MicrosoftEntraID({
    ...(clientId && clientId !== "undefined" ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    ...(issuer ? { issuer } : {}),
  });

  if (clientId && clientId !== "undefined") {
    provider.clientId = clientId;
  }
  if (clientSecret) {
    provider.clientSecret = clientSecret;
  }
  if (issuer) {
    provider.issuer = issuer;
  }

  return {
    providers: [provider],
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
