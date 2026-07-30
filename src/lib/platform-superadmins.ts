/**
 * Bootstrap platform SUPERADMINs from env. These accounts always receive
 * SUPERADMIN on sign-in and cannot be demoted from the admin UI.
 *
 * Additional superadmins can be granted in /admin/platform (persisted on User).
 */
export function bootstrapSuperadminEmails(): Set<string> {
  const raw = process.env.PLATFORM_SUPERADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isBootstrapSuperadminEmail(email: string): boolean {
  return bootstrapSuperadminEmails().has(email.trim().toLowerCase());
}
