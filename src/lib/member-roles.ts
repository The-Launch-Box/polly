import type { OrgRole } from "@/generated/prisma/client";
import type { SessionActor } from "@/lib/authz";
import { can } from "@/lib/authz";

const ORG_RANK: Record<OrgRole, number> = {
  CREATOR: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const ASSIGNABLE_ORG_ROLES: OrgRole[] = [
  "CREATOR",
  "MANAGER",
  "ADMIN",
  "OWNER",
];

/**
 * Who can change whose role:
 * - OWNER: can set CREATOR / MANAGER / ADMIN / OWNER (transfer)
 * - ADMIN: can set CREATOR / MANAGER only (not ADMIN/OWNER)
 * - Platform SUPERADMIN: same as OWNER within the active org console
 * - Nobody can change their own role via this API (avoids lockout)
 */
export function canAssignOrgRole(
  actor: SessionActor,
  targetUserId: string,
  newRole: OrgRole,
  targetCurrentRole: OrgRole,
): { ok: true } | { ok: false; error: string } {
  if (actor.id === targetUserId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  if (targetCurrentRole === "OWNER" && !can(actor, "org:owner") && actor.platformRole !== "SUPERADMIN") {
    return { ok: false, error: "Only the organization owner can change another owner's role." };
  }

  if (actor.platformRole === "SUPERADMIN" || can(actor, "org:owner")) {
    return { ok: true };
  }

  if (can(actor, "org:admin")) {
    if (ORG_RANK[newRole] >= ORG_RANK.ADMIN) {
      return {
        ok: false,
        error: "Admins can promote members to Creator or Manager only.",
      };
    }
    if (ORG_RANK[targetCurrentRole] >= ORG_RANK.ADMIN) {
      return {
        ok: false,
        error: "Admins cannot change Admin or Owner roles.",
      };
    }
    return { ok: true };
  }

  return { ok: false, error: "Forbidden." };
}
