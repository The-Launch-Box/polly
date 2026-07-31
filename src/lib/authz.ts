import type { FormAccessRole, OrgRole, PlatformRole } from "@/generated/prisma/client";

export type SessionActor = {
  id: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  schemaName: string;
  orgRole: OrgRole;
  platformRole: PlatformRole | null;
};

export type FormAuthzContext = {
  id: string;
  ownerUserId: string;
  access: Array<{
    userId: string | null;
    groupId: string | null;
    role: FormAccessRole;
    canExport: boolean;
  }>;
};

export type FormAction =
  | "form:view"
  | "form:view_responses"
  | "form:export"
  | "form:edit"
  | "form:delete_responses"
  | "form:manage_webhooks"
  | "form:create"
  | "group:manage"
  | "org:admin"
  | "org:owner"
  | "platform:superadmin";

const ORG_RANK: Record<OrgRole, number> = {
  CREATOR: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

function hasOrgRoleAtLeast(actor: SessionActor, minimum: OrgRole): boolean {
  return ORG_RANK[actor.orgRole] >= ORG_RANK[minimum];
}

function accessRoleFor(
  actor: SessionActor,
  form: FormAuthzContext,
  groupIds: string[],
): FormAccessRole | null {
  let best: FormAccessRole | null = null;
  const rank: Record<FormAccessRole, number> = {
    VIEWER: 1,
    ANALYST: 2,
    COLLABORATOR: 3,
  };

  for (const grant of form.access) {
    const matchesUser = grant.userId === actor.id;
    const matchesGroup = grant.groupId != null && groupIds.includes(grant.groupId);
    if (!matchesUser && !matchesGroup) continue;
    if (!best || rank[grant.role] > rank[best]) {
      best = grant.role;
    }
  }

  return best;
}

function grantCanExport(
  actor: SessionActor,
  form: FormAuthzContext,
  groupIds: string[],
): boolean {
  return form.access.some((grant) => {
    const matchesUser = grant.userId === actor.id;
    const matchesGroup = grant.groupId != null && groupIds.includes(grant.groupId);
    return (matchesUser || matchesGroup) && grant.canExport;
  });
}

/**
 * Central authorization for org roles + per-form grants.
 * Platform superadmins bypass org checks (still audit in the caller if needed).
 */
export function can(
  actor: SessionActor,
  action: FormAction,
  form?: FormAuthzContext,
  groupIds: string[] = [],
): boolean {
  if (actor.platformRole === "SUPERADMIN") {
    return true;
  }

  switch (action) {
    case "platform:superadmin":
      return false;
    case "org:owner":
      return actor.orgRole === "OWNER";
    case "org:admin":
      return hasOrgRoleAtLeast(actor, "ADMIN");
    case "group:manage":
      return hasOrgRoleAtLeast(actor, "MANAGER");
    case "form:create":
      return hasOrgRoleAtLeast(actor, "CREATOR");
    default:
      break;
  }

  if (!form) {
    return false;
  }

  if (hasOrgRoleAtLeast(actor, "ADMIN")) {
    return true;
  }

  const isOwner = form.ownerUserId === actor.id;
  const accessRole = accessRoleFor(actor, form, groupIds);
  // Managers may act on forms shared to groups they belong to (or own).
  const managerOnShared =
    hasOrgRoleAtLeast(actor, "MANAGER") &&
    (isOwner || accessRole != null);

  switch (action) {
    case "form:view":
      return (
        isOwner ||
        managerOnShared ||
        accessRole === "VIEWER" ||
        accessRole === "ANALYST" ||
        accessRole === "COLLABORATOR"
      );
    case "form:view_responses":
      return (
        isOwner ||
        managerOnShared ||
        accessRole === "ANALYST" ||
        accessRole === "COLLABORATOR"
      );
    case "form:export":
      return (
        isOwner ||
        managerOnShared ||
        accessRole === "COLLABORATOR" ||
        (accessRole === "ANALYST" && grantCanExport(actor, form, groupIds))
      );
    case "form:edit":
    case "form:manage_webhooks":
      return isOwner || managerOnShared || accessRole === "COLLABORATOR";
    case "form:delete_responses":
      // Managers (and above via ADMIN bypass), or the survey owner (e.g. CREATOR).
      return hasOrgRoleAtLeast(actor, "MANAGER") || isOwner;
    default:
      return false;
  }
}
