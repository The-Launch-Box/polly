import { redirect } from "next/navigation";
import { AdminNavLink } from "@/components/admin/AdminNavLink";
import { AppChrome } from "@/components/os-nav/AppChrome";
import { auth } from "@/auth";
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
    <AppChrome>
      <nav className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-2 text-sm lg:px-3">
        <AdminNavLink href="/admin/forms">Surveys</AdminNavLink>
        <AdminNavLink href="/admin/submissions">Submissions</AdminNavLink>
        <AdminNavLink href="/admin/groups">Groups</AdminNavLink>
        {showMembers && <AdminNavLink href="/admin/members">Members</AdminNavLink>}
        {actor.platformRole === "SUPERADMIN" && (
          <AdminNavLink href="/admin/platform">Platform</AdminNavLink>
        )}
      </nav>
      {children}
    </AppChrome>
  );
}
