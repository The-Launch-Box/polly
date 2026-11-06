import { auth } from "@/auth";
import { OsNavbar } from "./OsNavbar";

export async function AppChrome({
  children,
  appName = "Polly",
}: {
  children: React.ReactNode;
  appName?: string;
}) {
  const session = await auth().catch(() => null);
  const user = session?.user ?? null;
  const isAdmin =
    !!user &&
    (user.platformRole === "SUPERADMIN" ||
      user.orgRole === "ADMIN" ||
      user.orgRole === "OWNER");

  return (
    <div className="tlb-shell flex min-h-full flex-1 flex-col bg-background text-foreground">
      <OsNavbar
        appName={appName}
        user={
          user
            ? {
                name: user.name ?? user.email ?? "",
                email: user.email ?? "",
              }
            : null
        }
        isAdmin={isAdmin}
        organizationSlug={user?.organizationSlug ?? null}
        organizationId={user?.organizationId ?? null}
        canSwitchOrg={user?.platformRole === "SUPERADMIN"}
      />
      {children}
    </div>
  );
}
