import { auth } from "@/auth";
import type { SessionActor } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export class AuthzError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export async function requireActor(): Promise<SessionActor> {
  const session = await auth();
  const user = session?.user;

  if (
    !user?.id ||
    !user.email ||
    !user.organizationId ||
    !user.organizationSlug ||
    !user.schemaName ||
    !user.orgRole
  ) {
    throw new AuthzError("Unauthorized.", 401);
  }

  return {
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    organizationSlug: user.organizationSlug,
    schemaName: user.schemaName,
    orgRole: user.orgRole,
    platformRole: user.platformRole ?? null,
  };
}

export async function loadFormAuthzContext(actor: SessionActor, slug: string) {
  const form = await prisma.form.findFirst({
    where: { slug, organizationId: actor.organizationId },
    include: { access: true },
  });

  if (!form) {
    throw new AuthzError("Form not found.", 404);
  }

  return form;
}

export async function groupIdsForUser(actor: SessionActor): Promise<string[]> {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: actor.id },
    select: { groupId: true },
  });
  return memberships.map((row) => row.groupId);
}
