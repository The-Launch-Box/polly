import { can, type SessionActor } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * Forms the actor may see in admin lists, scoped to their organization.
 */
export async function listAccessibleForms(actor: SessionActor) {
  const groupIds = await prisma.groupMembership.findMany({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  const groupIdList = groupIds.map((row) => row.groupId);

  const forms = await prisma.form.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      access: true,
      _count: {
        select: {
          questions: true,
          submissions: true,
        },
      },
    },
  });

  const visible = can(actor, "org:admin")
    ? forms
    : forms.filter((form) =>
        can(
          actor,
          "form:view",
          {
            id: form.id,
            ownerUserId: form.ownerUserId,
            access: form.access,
          },
          groupIdList,
        ),
      );

  const ownerIds = [...new Set(visible.map((form) => form.ownerUserId))];
  const owners =
    ownerIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, email: true },
        });
  const ownerEmailById = new Map(owners.map((user) => [user.id, user.email]));

  return visible.map((form) => ({
    ...form,
    ownerEmail: ownerEmailById.get(form.ownerUserId) ?? null,
  }));
}
