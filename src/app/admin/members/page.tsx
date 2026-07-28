import Link from "next/link";
import { redirect } from "next/navigation";
import { MembersManager } from "@/components/admin/MembersManager";
import type { OrgRole } from "@/generated/prisma/client";
import { can } from "@/lib/authz";
import { ASSIGNABLE_ORG_ROLES } from "@/lib/member-roles";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/api/auth/signin?callbackUrl=/admin/members");
    }
    throw error;
  }

  if (!can(actor, "org:admin") && actor.platformRole !== "SUPERADMIN") {
    redirect("/admin/forms");
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: actor.organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
        },
      },
    },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Members</h1>
            <p className="text-sm text-zinc-500">
              Promote people to Manager or Admin for this organization.
            </p>
          </div>
          <Link href="/admin/forms" className="text-sm text-zinc-500 hover:text-zinc-800">
            Surveys
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <MembersManager
          currentUserId={actor.id}
          assignableRoles={ASSIGNABLE_ORG_ROLES as OrgRole[]}
          initialMembers={memberships.map((row) => ({
            userId: row.userId,
            email: row.user.email,
            name: row.user.name,
            role: row.role,
            platformRole: row.user.platformRole,
          }))}
        />
      </div>
    </>
  );
}
