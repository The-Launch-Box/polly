import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { can } from "@/lib/authz";
import type { SessionActor } from "@/lib/authz";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/admin/submissions");
  }

  const actor: SessionActor = {
    id: session.user.id,
    email: session.user.email ?? "",
    organizationId: session.user.organizationId,
    organizationSlug: session.user.organizationSlug,
    schemaName: session.user.schemaName,
    orgRole: session.user.orgRole,
    platformRole: session.user.platformRole,
  };

  const showMembers = can(actor, "org:admin") || actor.platformRole === "SUPERADMIN";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-medium text-zinc-900">Admin</span>
            <Link
              href="/admin/forms"
              className="text-zinc-500 transition hover:text-zinc-800"
            >
              Surveys
            </Link>
            <Link
              href="/admin/submissions"
              className="text-zinc-500 transition hover:text-zinc-800"
            >
              Submissions
            </Link>
            <Link
              href="/admin/groups"
              className="text-zinc-500 transition hover:text-zinc-800"
            >
              Groups
            </Link>
            {showMembers && (
              <Link
                href="/admin/members"
                className="text-zinc-500 transition hover:text-zinc-800"
              >
                Members
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {actor.platformRole === "SUPERADMIN" && (
              <OrgSwitcher activeOrganizationId={actor.organizationId} />
            )}
            {session.user.organizationSlug && (
              <span className="hidden rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 lg:inline">
                {session.user.organizationSlug}
              </span>
            )}
            {session.user.email && (
              <span className="hidden text-zinc-500 xl:inline">
                {session.user.email}
              </span>
            )}
            {session.user.orgRole && (
              <span className="hidden text-xs uppercase tracking-wide text-zinc-400 sm:inline">
                {session.user.orgRole}
              </span>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-zinc-500 transition hover:text-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
