"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FormAccessRole } from "@/generated/prisma/client";

type AccessRow = {
  id: string;
  role: FormAccessRole;
  canExport: boolean;
  groupId: string | null;
  groupName: string | null;
};

type GroupOption = {
  id: string;
  name: string;
  slug: string;
};

export function FormSharingManager({
  slug,
  canManage,
  initialAccess,
  groups,
  roles,
}: {
  slug: string;
  canManage: boolean;
  initialAccess: AccessRow[];
  groups: GroupOption[];
  roles: FormAccessRole[];
}) {
  const router = useRouter();
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState<FormAccessRole>("VIEWER");
  const [canExport, setCanExport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sharedGroupIds = new Set(
    initialAccess.map((row) => row.groupId).filter(Boolean),
  );
  const availableGroups = groups.filter((group) => !sharedGroupIds.has(group.id));

  function addShare(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/forms/${slug}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, role, canExport }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not share survey.");
        return;
      }
      setGroupId("");
      setRole("VIEWER");
      setCanExport(false);
      router.refresh();
    });
  }

  function removeShare(accessId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/admin/forms/${slug}/access?accessId=${encodeURIComponent(accessId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError("Could not remove share.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Current shares
        </h2>
        {initialAccess.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Not shared with any groups yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {initialAccess.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">
                    {row.groupName ?? "Group"}
                  </p>
                  <p className="text-zinc-500">
                    {row.role}
                    {row.canExport ? " · can export" : ""}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeShare(row.id)}
                    className="text-xs text-zinc-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <form
          onSubmit={addShare}
          className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Share with a group
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Group</span>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2"
                required
              >
                <option value="">Select group…</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Access</span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as FormAccessRole)
                }
                className="rounded-lg border border-zinc-300 px-3 py-2"
              >
                {roles.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(role === "ANALYST" || role === "COLLABORATOR") && (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={canExport}
                onChange={(event) => setCanExport(event.target.checked)}
              />
              Allow CSV export
            </label>
          )}
          <p className="text-xs text-zinc-500">
            Viewer = dashboards only · Analyst = responses · Collaborator = edit
            questions
          </p>
          <button
            type="submit"
            disabled={pending || availableGroups.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Share survey
          </button>
          {availableGroups.length === 0 && (
            <p className="text-sm text-zinc-500">
              Create a group under Groups, or this survey is already shared with
              every group.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
