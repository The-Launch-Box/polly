import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AdminNavLink } from "@/components/admin/AdminNavLink";
import { OrgSwitcher } from "@/components/admin/OrgSwitcher";
import { LaunchBoxWordmark } from "@/components/LaunchBoxWordmark";
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
    <div className="tlb-shell min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
            <LaunchBoxWordmark href="/" className="shrink-0" />
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              <AdminNavLink href="/admin/forms">Surveys</AdminNavLink>
              <AdminNavLink href="/admin/submissions">Submissions</AdminNavLink>
              <AdminNavLink href="/admin/groups">Groups</AdminNavLink>
              {showMembers && (
                <AdminNavLink href="/admin/members">Members</AdminNavLink>
              )}
              {actor.platformRole === "SUPERADMIN" && (
                <AdminNavLink href="/admin/platform">Platform</AdminNavLink>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm">
            {actor.platformRole === "SUPERADMIN" && (
              <OrgSwitcher activeOrganizationId={actor.organizationId} />
            )}
            {session.user.organizationSlug && (
              <span className="hidden rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground lg:inline">
                {session.user.organizationSlug}
              </span>
            )}
            {session.user.email && (
              <span className="hidden text-muted-foreground xl:inline">
                {session.user.email}
              </span>
            )}
            {session.user.orgRole && (
              <span className="hidden text-xs uppercase tracking-[0.14em] text-fg-faint sm:inline">
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
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
