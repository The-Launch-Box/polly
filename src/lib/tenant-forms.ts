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

  if (can(actor, "org:admin")) {
    return forms;
  }

  return forms.filter((form) =>
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
}
