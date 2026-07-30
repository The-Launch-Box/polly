import { NextResponse } from "next/server";
import type { FormAccessRole } from "@/generated/prisma/client";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  AuthzError,
  groupIdsForUser,
  loadFormAuthzContext,
  requireActor,
} from "@/lib/session";

type RouteContext = { params: Promise<{ slug: string }> };

const ROLES: FormAccessRole[] = ["VIEWER", "ANALYST", "COLLABORATOR"];

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:view", form, groupIds)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const access = await prisma.formAccess.findMany({
      where: { formId: form.id },
      include: {
        group: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const groups = await prisma.group.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({
      canManage: can(actor, "form:edit", form, groupIds) || can(actor, "group:manage"),
      access: access.map((row) => ({
        id: row.id,
        role: row.role,
        canExport: row.canExport,
        groupId: row.groupId,
        groupName: row.group?.name ?? null,
        userId: row.userId,
      })),
      groups,
      roles: ROLES,
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:edit", form, groupIds) && !can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: {
      groupId?: unknown;
      role?: unknown;
      canExport?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    const role =
      typeof body.role === "string" && ROLES.includes(body.role as FormAccessRole)
        ? (body.role as FormAccessRole)
        : null;
    if (!groupId || !role) {
      return NextResponse.json(
        { error: "groupId and role are required." },
        { status: 400 },
      );
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId: actor.organizationId },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const existing = await prisma.formAccess.findFirst({
      where: { formId: form.id, groupId },
    });

    const canExport =
      role === "ANALYST" || role === "COLLABORATOR"
        ? Boolean(body.canExport)
        : false;

    const row = existing
      ? await prisma.formAccess.update({
          where: { id: existing.id },
          data: { role, canExport },
        })
      : await prisma.formAccess.create({
          data: {
            formId: form.id,
            groupId,
            role,
            canExport,
          },
        });

    return NextResponse.json(
      {
        id: row.id,
        groupId: row.groupId,
        role: row.role,
        canExport: row.canExport,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return authzResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { slug } = await context.params;
    const form = await loadFormAuthzContext(actor, slug);
    const groupIds = await groupIdsForUser(actor);

    if (!can(actor, "form:edit", form, groupIds) && !can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const accessId = new URL(request.url).searchParams.get("accessId")?.trim() ?? "";
    if (!accessId) {
      return NextResponse.json({ error: "accessId is required." }, { status: 400 });
    }

    const existing = await prisma.formAccess.findFirst({
      where: { id: accessId, formId: form.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Share not found." }, { status: 404 });
    }

    await prisma.formAccess.delete({ where: { id: existing.id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return authzResponse(error);
  }
}
