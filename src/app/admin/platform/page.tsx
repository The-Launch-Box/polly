import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PlatformUsersManager,
  type PlatformUserRow,
} from "@/components/admin/PlatformUsersManager";
import { isBootstrapSuperadminEmail } from "@/lib/platform-superadmins";
import { prisma } from "@/lib/prisma";
import { AuthzError, requireActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPlatformPage() {
  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/api/auth/signin?callbackUrl=/admin/platform");
    }
    throw error;
  }

  if (actor.platformRole !== "SUPERADMIN") {
    redirect("/admin/forms");
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

  const initialUsers: PlatformUserRow[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    platformRole: user.platformRole === "SUPERADMIN" ? "SUPERADMIN" : null,
    isBootstrap: isBootstrapSuperadminEmail(user.email),
    organizations: user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    })),
  }));

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Platform</h1>
            <p className="text-sm text-zinc-500">
              Manage platform SUPERADMIN across every organization.
            </p>
          </div>
          <Link
            href="/admin/forms"
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            Surveys
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PlatformUsersManager
          currentUserId={actor.id}
          initialUsers={initialUsers}
        />
      </div>
    </>
  );
}
