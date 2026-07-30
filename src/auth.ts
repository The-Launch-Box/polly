import NextAuth from "next-auth";
import type { OrgRole, PlatformRole } from "@/generated/prisma/client";
import { authConfig } from "@/auth.config";
import {
  findOrganizationByEmail,
  getPlatformHomeOrganization,
} from "@/lib/organizations";
import { isBootstrapSuperadminEmail } from "@/lib/platform-superadmins";
import { prisma } from "@/lib/prisma";
import { syncOrganizationsAndSchemas } from "@/lib/tenant-schema";

function entraOidFromProfile(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const record = profile as Record<string, unknown>;
  const oid = record.oid ?? record.sub;
  return typeof oid === "string" && oid.length > 0 ? oid : null;
}

let organizationsReady: Promise<void> | null = null;

async function ensureOrganizationsReady() {
  if (!organizationsReady) {
    organizationsReady = syncOrganizationsAndSchemas()
      .then(() => undefined)
      .catch((error) => {
        organizationsReady = null;
        throw error;
      });
  }
  await organizationsReady;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, profile }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) {
        return false;
      }

      // Bootstrap SUPERADMINs come only from PLATFORM_SUPERADMIN_EMAILS.
      // UI-granted SUPERADMIN on User.platformRole is preserved across logins.
      const isBootstrapSuperadmin = isBootstrapSuperadminEmail(email);
      const orgDef = findOrganizationByEmail(email);
      if (!orgDef) {
        console.warn(`Sign-in rejected: unregistered email domain (${email})`);
        // Redirect to branded page instead of Auth.js AccessDenied / Microsoft default.
        return "/unauthorized";
      }

      const oid = entraOidFromProfile(profile);
      if (!oid) {
        console.warn(`Sign-in rejected: missing Entra oid for ${email}`);
        return false;
      }

      try {
        await ensureOrganizationsReady();

        const organization = await prisma.organization.findUnique({
          where: { slug: orgDef.slug },
        });
        if (!organization) {
          console.warn(`Sign-in rejected: organization missing for ${orgDef.slug}`);
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { entraOid: oid },
        });

        const dbUser = existingUser
          ? await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                email,
                name: user.name ?? undefined,
                // Only bootstrap emails force SUPERADMIN; never clear UI grants.
                ...(isBootstrapSuperadmin
                  ? { platformRole: "SUPERADMIN" as PlatformRole }
                  : {}),
              },
            })
          : await prisma.user.create({
              data: {
                email,
                name: user.name ?? null,
                entraOid: oid,
                platformRole: isBootstrapSuperadmin ? "SUPERADMIN" : null,
                activeOrganizationId: isBootstrapSuperadmin
                  ? organization.id
                  : null,
              },
            });

        if (dbUser.email !== email) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { email },
          });
        }

        // Bootstrap operators always have Owner membership on The Launch Box.
        const homeOrg = await prisma.organization.findUnique({
          where: { slug: getPlatformHomeOrganization().slug },
        });
        if (isBootstrapSuperadmin && homeOrg) {
          await prisma.organizationMembership.upsert({
            where: {
              userId_organizationId: {
                userId: dbUser.id,
                organizationId: homeOrg.id,
              },
            },
            update: {},
            create: {
              userId: dbUser.id,
              organizationId: homeOrg.id,
              role: "OWNER",
            },
          });
          if (!dbUser.activeOrganizationId) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { activeOrganizationId: homeOrg.id },
            });
          }
        }

        const existingMembership = await prisma.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: dbUser.id,
              organizationId: organization.id,
            },
          },
        });

        if (!existingMembership) {
          const memberCount = await prisma.organizationMembership.count({
            where: { organizationId: organization.id },
          });

          const role: OrgRole =
            isBootstrapSuperadmin &&
            organization.slug === getPlatformHomeOrganization().slug
              ? "OWNER"
              : memberCount === 0
                ? "OWNER"
                : "CREATOR";

          await prisma.organizationMembership.create({
            data: {
              userId: dbUser.id,
              organizationId: organization.id,
              role,
            },
          });
        }

        return true;
      } catch (error) {
        console.error("Sign-in provisioning failed:", error);
        return false;
      }
    },

    async jwt({ token, user, profile }) {
      const email =
        (typeof token.email === "string" && token.email) ||
        user?.email ||
        null;

      if (!email) {
        return token;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const oid = entraOidFromProfile(profile) ?? null;

      try {
        const dbUser = oid
          ? await prisma.user.findUnique({ where: { entraOid: oid } })
          : await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (!dbUser) {
          return token;
        }

        token.userId = dbUser.id;
        token.email = dbUser.email;
        token.platformRole = dbUser.platformRole;
        token.homeOrganizationId = undefined;

        const homeMembership = await prisma.organizationMembership.findFirst({
          where: {
            userId: dbUser.id,
            organization: { slug: getPlatformHomeOrganization().slug },
          },
          include: { organization: true },
        });

        const defaultMembership =
          homeMembership ??
          (await prisma.organizationMembership.findFirst({
            where: { userId: dbUser.id },
            include: { organization: true },
            orderBy: { createdAt: "asc" },
          }));

        if (!defaultMembership) {
          return token;
        }

        token.homeOrganizationId = defaultMembership.organizationId;

        let activeOrg = defaultMembership.organization;
        let activeRole = defaultMembership.role;

        if (
          dbUser.platformRole === "SUPERADMIN" &&
          dbUser.activeOrganizationId &&
          dbUser.activeOrganizationId !== defaultMembership.organizationId
        ) {
          const switched = await prisma.organization.findUnique({
            where: { id: dbUser.activeOrganizationId },
          });
          if (switched) {
            activeOrg = switched;
            const switchedMembership =
              await prisma.organizationMembership.findUnique({
                where: {
                  userId_organizationId: {
                    userId: dbUser.id,
                    organizationId: switched.id,
                  },
                },
              });
            // When viewing another customer org, act with Admin-level console
            // powers in the UI; can() still bypasses via SUPERADMIN.
            activeRole = switchedMembership?.role ?? "ADMIN";
          }
        }

        token.organizationId = activeOrg.id;
        token.organizationSlug = activeOrg.slug;
        token.schemaName = activeOrg.schemaName;
        token.orgRole = activeRole;
      } catch (error) {
        console.error("JWT enrichment failed:", error);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.organizationId =
          typeof token.organizationId === "string" ? token.organizationId : "";
        session.user.organizationSlug =
          typeof token.organizationSlug === "string"
            ? token.organizationSlug
            : "";
        session.user.schemaName =
          typeof token.schemaName === "string" ? token.schemaName : "";
        session.user.orgRole =
          typeof token.orgRole === "string"
            ? (token.orgRole as OrgRole)
            : "CREATOR";
        session.user.platformRole =
          token.platformRole === "SUPERADMIN" ? "SUPERADMIN" : null;
        session.user.homeOrganizationId =
          typeof token.homeOrganizationId === "string"
            ? token.homeOrganizationId
            : null;
      }
      return session;
    },
  },
});
