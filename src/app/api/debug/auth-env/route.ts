export const runtime = "nodejs";

/**
 * Temporary diagnostics for Railway auth env. Does not expose secret values.
 * Visit: /api/debug/auth-env
 * Remove once auth is confirmed working.
 */
export async function GET() {
  const id = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const secret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  const authSecret = process.env.AUTH_SECRET;
  const authUrl = process.env.AUTH_URL;

  return Response.json({
    AUTH_MICROSOFT_ENTRA_ID_ID: {
      present: Boolean(id?.trim()),
      length: id?.trim().length ?? 0,
      isLiteralUndefined: id === "undefined",
    },
    AUTH_MICROSOFT_ENTRA_ID_SECRET: {
      present: Boolean(secret?.trim()),
      length: secret?.trim().length ?? 0,
    },
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: {
      present: Boolean(issuer?.trim()),
      length: issuer?.trim().length ?? 0,
      endsWithV2: Boolean(issuer?.includes("/v2.0")),
    },
    AUTH_SECRET: { present: Boolean(authSecret?.trim()) },
    AUTH_URL: { present: Boolean(authUrl?.trim()), value: authUrl ?? null },
    authRelatedKeys: Object.keys(process.env)
      .filter((k) => /AUTH|MICROSOFT|ENTRA/i.test(k))
      .sort(),
  });
}
