import type { DefaultSession } from "next-auth";
import type { OrgRole, PlatformRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string;
      organizationSlug: string;
      schemaName: string;
      orgRole: OrgRole;
      platformRole: PlatformRole | null;
      homeOrganizationId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    organizationId?: string;
    organizationSlug?: string;
    schemaName?: string;
    orgRole?: OrgRole;
    platformRole?: PlatformRole | null;
    homeOrganizationId?: string;
  }
}
