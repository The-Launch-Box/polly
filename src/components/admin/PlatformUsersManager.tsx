"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type OrgMembership = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type PlatformUserRow = {
  id: string;
  email: string;
  name: string | null;
  platformRole: "SUPERADMIN" | null;
  isBootstrap: boolean;
  organizations: OrgMembership[];
};

export function PlatformUsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: PlatformUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialUsers;
    return initialUsers.filter((user) => {
      const orgText = user.organizations
        .map((org) => `${org.name} ${org.slug}`)
        .join(" ");
      return `${user.email} ${user.name ?? ""} ${orgText}`
        .toLowerCase()
        .includes(needle);
    });
  }, [initialUsers, query]);

  function setSuperadmin(userId: string, grant: boolean) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          platformRole: grant ? "SUPERADMIN" : null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not update platform role.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email, or organization…"
          className="min-w-[16rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="text-sm text-zinc-500">
          {filtered.length} of {initialUsers.length} users
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Organizations</th>
              <th className="px-4 py-3 font-medium">Platform</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isSuperadmin = user.platformRole === "SUPERADMIN";
              const canRevoke =
                isSuperadmin &&
                !user.isBootstrap &&
                user.id !== currentUserId;

              return (
                <tr key={user.id} className="border-b border-zinc-50 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">
                      {user.name ?? user.email}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs font-normal text-zinc-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-zinc-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {user.organizations.length === 0 ? (
                      <span className="text-zinc-400">No memberships</span>
                    ) : (
                      <ul className="space-y-1">
                        {user.organizations.map((org) => (
                          <li key={org.id}>
                            {org.name}{" "}
                            <span className="text-zinc-400">
                              ({org.role.toLowerCase()})
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSuperadmin ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-700">
                          Superadmin
                          {user.isBootstrap ? " · bootstrap" : ""}
                        </span>
                        {canRevoke && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setSuperadmin(user.id, false)}
                            className="text-xs text-red-600 hover:underline disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                        {user.isBootstrap && (
                          <span className="text-xs text-zinc-400">
                            Set via PLATFORM_SUPERADMIN_EMAILS
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setSuperadmin(user.id, true)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        Make superadmin
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No users match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Platform SUPERADMIN</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Bootstrap accounts in{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">
              PLATFORM_SUPERADMIN_EMAILS
            </code>{" "}
            always stay superadmin and cannot be demoted here.
          </li>
          <li>
            Granting SUPERADMIN here works for any signed-in user across all
            organizations. They may need to sign out and back in to pick up the
            new role.
          </li>
          <li>
            Superadmins can switch organizations and bypass org-level permission
            checks.
          </li>
        </ul>
      </div>
    </div>
  );
}
