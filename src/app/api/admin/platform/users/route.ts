import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBootstrapSuperadminEmail } from "@/lib/platform-superadmins";
import { AuthzError, requireActor } from "@/lib/session";

function authzResponse(error: unknown) {
  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

/** All users across every organization (platform SUPERADMIN only). */
export async function GET() {
  try {
    const actor = await requireActor();
    if (actor.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: [{ email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        isBootstrap: isBootstrapSuperadminEmail(user.email),
        organizations: user.memberships.map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          role: membership.role,
        })),
      })),
    });
  } catch (error) {
    return authzResponse(error);
  }
}

/** Grant or revoke platform SUPERADMIN for any user. */
export async function PATCH(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: { userId?: unknown; platformRole?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const nextRole =
      body.platformRole === "SUPERADMIN"
        ? ("SUPERADMIN" as const)
        : body.platformRole === null
          ? null
          : undefined;

    if (nextRole === undefined) {
      return NextResponse.json(
        { error: 'platformRole must be "SUPERADMIN" or null.' },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (nextRole === null) {
      if (target.id === actor.id) {
        return NextResponse.json(
          { error: "You cannot remove your own platform SUPERADMIN role." },
          { status: 400 },
        );
      }
      if (isBootstrapSuperadminEmail(target.email)) {
        return NextResponse.json(
          {
            error:
              "This account is listed in PLATFORM_SUPERADMIN_EMAILS and cannot be demoted here.",
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { platformRole: nextRole },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
      },
    });

    return NextResponse.json({
      user: {
        ...updated,
        isBootstrap: isBootstrapSuperadminEmail(updated.email),
      },
    });
  } catch (error) {
    return authzResponse(error);
  }
}
