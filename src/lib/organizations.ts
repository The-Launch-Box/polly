/**
 * Canonical organizations. Each maps to one Postgres schema
 * (`tenant_<slug>`) inside the shared Azure database.
 *
 * The Launch Box is the platform operator / home org for TLB staff.
 */
export const PLATFORM_HOME_ORG_SLUG = "the-launch-box" as const;

export const ORGANIZATIONS = [
  {
    name: "The Launch Box",
    slug: PLATFORM_HOME_ORG_SLUG,
    emailDomain: "thelaunchbox.com",
  },
  {
    name: "Improvizations",
    slug: "improvizations",
    emailDomain: "improvizations.com",
  },
  {
    name: "Hyperscayle",
    slug: "hyperscayle",
    emailDomain: "hyperscayle.com",
  },
  {
    name: "BlueTrail Digital",
    slug: "bluetrail-digital",
    emailDomain: "bluetraildigital.com",
  },
  {
    name: "DX Foundation",
    slug: "dx-foundation",
    emailDomain: "dxfoundations.com",
  },
  {
    name: "Echelon",
    slug: "echelon",
    emailDomain: "echeloncyber.com",
  },
  {
    name: "VEScape Labs",
    slug: "vescape-labs",
    emailDomain: "vescapelabs.com",
  },
  {
    name: "Kinavic",
    slug: "kinavic",
    emailDomain: "kinavic.com",
  },
  {
    name: "Proscalar",
    slug: "proscalar",
    emailDomain: "proscalar.com",
  },
  {
    name: "Delicious Digital",
    slug: "delicious-digital",
    emailDomain: "deliciousdigitalmarketing.com",
  },
] as const;

export type OrganizationDefinition = (typeof ORGANIZATIONS)[number];

export function getPlatformHomeOrganization(): OrganizationDefinition {
  const home = ORGANIZATIONS.find((org) => org.slug === PLATFORM_HOME_ORG_SLUG);
  if (!home) {
    throw new Error("Platform home organization is not configured");
  }
  return home;
}

export function tenantSchemaName(orgSlug: string): string {
  const normalized = orgSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `tenant_${normalized}`;
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

export function findOrganizationByEmail(
  email: string,
): OrganizationDefinition | undefined {
  const domain = emailDomain(email);
  if (!domain) return undefined;
  return ORGANIZATIONS.find((org) => org.emailDomain === domain);
}

export function isSafeTenantSchemaName(schemaName: string): boolean {
  return /^tenant_[a-z0-9_]+$/.test(schemaName);
}

export function slugifyGroupName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "group"
  );
}
