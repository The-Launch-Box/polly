import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GroupDetailManager } from "@/components/admin/GroupDetailManager";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminGroupDetailPage({ params }: PageProps) {
  const { id } = await params;

  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect(`/api/auth/signin?callbackUrl=/admin/groups/${id}`);
    }
    throw error;
  }

  const group = await prisma.group.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: {
      members: true,
      formAccess: {
        include: {
          form: { select: { slug: true, title: true } },
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const memberUsers = await prisma.user.findMany({
    where: { id: { in: group.members.map((m) => m.userId) } },
    select: { id: true, email: true, name: true },
  });
  const userById = new Map(memberUsers.map((u) => [u.id, u]));

  const orgMembers = await prisma.organizationMembership.findMany({
    where: { organizationId: actor.organizationId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{group.name}</h1>
            <p className="text-sm text-zinc-500">Group · {group.slug}</p>
          </div>
          <Link href="/admin/groups" className="text-sm text-zinc-500 hover:text-zinc-800">
            All groups
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <GroupDetailManager
          groupId={group.id}
          name={group.name}
          canManage={can(actor, "group:manage")}
          initialMembers={group.members.map((m) => ({
            userId: m.userId,
            email: userById.get(m.userId)?.email ?? m.userId,
            name: userById.get(m.userId)?.name ?? null,
          }))}
          initialShares={group.formAccess.map((access) => ({
            id: access.id,
            formSlug: access.form.slug,
            formTitle: access.form.title,
            role: access.role,
            canExport: access.canExport,
          }))}
          orgMembers={orgMembers.map((m) => ({
            userId: m.user.id,
            email: m.user.email,
            name: m.user.name,
          }))}
        />
      </div>
    </>
  );
}
