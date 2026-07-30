import { NextResponse } from "next/server";
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
    if (actor.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        emailDomain: true,
      },
    });

    return NextResponse.json({
      organizations,
      activeOrganizationId: actor.organizationId,
    });
  } catch (error) {
    return authzResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: { organizationId?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const organizationId =
      typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required." },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: actor.id },
      data: { activeOrganizationId: organization.id },
    });

    return NextResponse.json({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      name: organization.name,
      // Client should reload so JWT/session picks up the new active org.
      reload: true,
    });
  } catch (error) {
    return authzResponse(error);
  }
}
