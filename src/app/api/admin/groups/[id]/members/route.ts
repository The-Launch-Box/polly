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

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    if (!can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { id } = await context.params;
    const group = await prisma.group.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    let body: { userId?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
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
      return NextResponse.json(
        { error: "User is not a member of this organization." },
        { status: 400 },
      );
    }

    await prisma.groupMembership.upsert({
      where: {
        groupId_userId: { groupId: group.id, userId },
      },
      update: {},
      create: { groupId: group.id, userId },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireActor();
    if (!can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { id } = await context.params;
    const group = await prisma.group.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    await prisma.groupMembership.deleteMany({
      where: { groupId: group.id, userId },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return authzResponse(error);
  }
}
