import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormSharingManager } from "@/components/admin/FormSharingManager";
import type { FormAccessRole } from "@/generated/prisma/client";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

const ROLES: FormAccessRole[] = ["VIEWER", "ANALYST", "COLLABORATOR"];

export default async function FormSharingPage({ params }: PageProps) {
  const { slug } = await params;

  let actor;
  let form;
  let groupIds: string[] = [];
  try {
    actor = await requireActor();
    form = await loadFormAuthzContext(actor, slug);
    groupIds = await groupIdsForUser(actor);
    if (!can(actor, "form:view", form, groupIds)) {
      notFound();
    }
  } catch (error) {
    if (error instanceof AuthzError) {
      if (error.status === 401) {
        redirect(`/api/auth/signin?callbackUrl=/admin/forms/${slug}/sharing`);
      }
      notFound();
    }
    throw error;
  }

  const access = await prisma.formAccess.findMany({
    where: { formId: form.id },
    include: {
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = await prisma.group.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const formMeta = await prisma.form.findFirst({
    where: { id: form.id },
    select: { title: true, slug: true },
  });

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Sharing</h1>
            <p className="text-sm text-zinc-500">
              {formMeta?.title ?? slug} · /q/{formMeta?.slug ?? slug}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link
              href={`/admin/forms/${slug}/edit`}
              className="text-zinc-500 hover:text-zinc-800"
            >
              Edit
            </Link>
            <Link href="/admin/groups" className="text-zinc-500 hover:text-zinc-800">
              Groups
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <FormSharingManager
          slug={slug}
          canManage={
            can(actor, "form:edit", form, groupIds) || can(actor, "group:manage")
          }
          roles={ROLES}
          groups={groups}
          initialAccess={access.map((row) => ({
            id: row.id,
            role: row.role,
            canExport: row.canExport,
            groupId: row.groupId,
            groupName: row.group?.name ?? null,
          }))}
        />
      </div>
    </>
  );
}
