import { NextResponse } from "next/server";
import type { OrgRole } from "@/generated/prisma/client";
import { can } from "@/lib/authz";
import { canAssignOrgRole, ASSIGNABLE_ORG_ROLES } from "@/lib/member-roles";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    const actor = await requireActor();
    if (!can(actor, "org:admin") && actor.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

    return NextResponse.json({
      members: memberships.map((row) => ({
        membershipId: row.id,
        userId: row.userId,
        role: row.role,
        email: row.user.email,
        name: row.user.name,
        platformRole: row.user.platformRole,
        createdAt: row.createdAt,
      })),
      assignableRoles: ASSIGNABLE_ORG_ROLES,
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor();

    let body: { userId?: unknown; role?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = typeof body.role === "string" ? (body.role as OrgRole) : null;
    if (!userId || !role || !ASSIGNABLE_ORG_ROLES.includes(role)) {
      return NextResponse.json({ error: "userId and a valid role are required." }, { status: 400 });
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: actor.organizationId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Member not found in this organization." }, { status: 404 });
    }

    const allowed = canAssignOrgRole(actor, userId, role, membership.role);
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 403 });
    }

    if (membership.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await prisma.organizationMembership.count({
        where: { organizationId: actor.organizationId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Promote another owner before demoting the last owner." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.organizationMembership.update({
      where: { id: membership.id },
      data: { role },
    });

    return NextResponse.json({ userId: updated.userId, role: updated.role });
  } catch (error) {
    return authzResponse(error);
  }
}
