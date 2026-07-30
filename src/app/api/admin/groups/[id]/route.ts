import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

async function loadOrgGroup(actorOrgId: string, id: string) {
  return prisma.group.findFirst({
    where: { id, organizationId: actorOrgId },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const group = await prisma.group.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        members: true,
        formAccess: {
          include: {
            form: { select: { id: true, slug: true, title: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
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
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      id: group.id,
      name: group.name,
      slug: group.slug,
      canManage: can(actor, "group:manage"),
      members: group.members.map((m) => ({
        userId: m.userId,
        email: userById.get(m.userId)?.email ?? m.userId,
        name: userById.get(m.userId)?.name ?? null,
      })),
      shares: group.formAccess.map((access) => ({
        id: access.id,
        formId: access.formId,
        formSlug: access.form.slug,
        formTitle: access.form.title,
        role: access.role,
        canExport: access.canExport,
      })),
      orgMembers: orgMembers.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
      })),
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    if (!can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { id } = await context.params;
    const group = await loadOrgGroup(actor.organizationId, id);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    let body: { name?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const updated = await prisma.group.update({
      where: { id: group.id },
      data: { name },
    });

    return NextResponse.json({ id: updated.id, name: updated.name, slug: updated.slug });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    if (!can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { id } = await context.params;
    const group = await loadOrgGroup(actor.organizationId, id);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    await prisma.group.delete({ where: { id: group.id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return authzResponse(error);
  }
}
