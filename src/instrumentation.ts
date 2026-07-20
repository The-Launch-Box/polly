export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const keys = Object.keys(process.env)
    .filter((k) => /AUTH|MICROSOFT|ENTRA/i.test(k))
    .sort();

  console.info("[auth:boot]", {
    hasClientId: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim()),
    hasClientSecret: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim()),
    hasIssuer: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim()),
    hasSecret: Boolean(process.env.AUTH_SECRET?.trim()),
    hasAuthUrl: Boolean(process.env.AUTH_URL?.trim()),
    authRelatedEnvKeys: keys,
  });
}
