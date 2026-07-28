import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupsManager } from "@/components/admin/GroupsManager";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/api/auth/signin?callbackUrl=/admin/groups");
    }
    throw error;
  }

  const groups = await prisma.group.findMany({
    where: { organizationId: actor.organizationId },
    include: {
      _count: { select: { members: true, formAccess: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Groups</h1>
            <p className="text-sm text-zinc-500">
              Share surveys with teams inside your organization.
            </p>
          </div>
          <Link href="/admin/forms" className="text-sm text-zinc-500 hover:text-zinc-800">
            Surveys
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <GroupsManager
          canManage={can(actor, "group:manage")}
          initialGroups={groups.map((group) => ({
            id: group.id,
            name: group.name,
            slug: group.slug,
            memberCount: group._count.members,
            sharedFormCount: group._count.formAccess,
          }))}
        />
      </div>
    </>
  );
}
