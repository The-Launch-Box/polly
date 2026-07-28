import { NextResponse } from "next/server";
import { can } from "@/lib/authz";
import { slugifyGroupName } from "@/lib/organizations";
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

    const groups = await prisma.group.findMany({
      where: { organizationId: actor.organizationId },
      include: {
        _count: { select: { members: true, formAccess: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: group._count.members,
        sharedFormCount: group._count.formAccess,
        createdAt: group.createdAt,
      })),
      canManage: can(actor, "group:manage"),
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (!can(actor, "group:manage")) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

    let slug = slugifyGroupName(name);
    const existing = await prisma.group.findUnique({
      where: {
        organizationId_slug: {
          organizationId: actor.organizationId,
          slug,
        },
      },
    });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const group = await prisma.group.create({
      data: {
        name,
        slug,
        organizationId: actor.organizationId,
        createdByUserId: actor.id,
        members: {
          create: { userId: actor.id },
        },
      },
    });

    return NextResponse.json(
      { id: group.id, name: group.name, slug: group.slug },
      { status: 201 },
    );
  } catch (error) {
    return authzResponse(error);
  }
}
