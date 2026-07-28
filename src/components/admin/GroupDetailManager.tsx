"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Member = {
  userId: string;
  email: string;
  name: string | null;
};

type Share = {
  id: string;
  formSlug: string;
  formTitle: string;
  role: string;
  canExport: boolean;
};

type OrgMember = {
  userId: string;
  email: string;
  name: string | null;
};

export function GroupDetailManager({
  groupId,
  name,
  canManage,
  initialMembers,
  initialShares,
  orgMembers,
}: {
  groupId: string;
  name: string;
  canManage: boolean;
  initialMembers: Member[];
  initialShares: Share[];
  orgMembers: OrgMember[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const memberIds = new Set(initialMembers.map((m) => m.userId));
  const candidates = orgMembers.filter((m) => !memberIds.has(m.userId));

  function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not add member.");
        return;
      }
      setUserId("");
      router.refresh();
    });
  }

  function removeMember(targetUserId: string) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/admin/groups/${groupId}/members?userId=${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not remove member.");
        return;
      }
      router.refresh();
    });
  }

  function deleteGroup() {
    if (!window.confirm(`Delete group “${name}”? Shared survey access will be removed.`)) {
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/admin/groups/${groupId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Could not delete group.");
        return;
      }
      router.push("/admin/groups");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Members
        </h2>
        <ul className="mt-4 divide-y divide-zinc-100">
          {initialMembers.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-900">
                  {member.name ?? member.email}
                </p>
                {member.name && (
                  <p className="text-zinc-500">{member.email}</p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeMember(member.userId)}
                  className="text-xs text-zinc-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {canManage && candidates.length > 0 && (
          <form onSubmit={addMember} className="mt-4 flex flex-wrap gap-2">
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="min-w-[14rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Add organization member…</option>
              {candidates.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Add
            </button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Shared surveys
        </h2>
        {initialShares.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No surveys shared with this group yet. Open a survey → Sharing to
            grant access.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {initialShares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{share.formTitle}</p>
                  <p className="text-zinc-500">
                    /q/{share.formSlug} · {share.role}
                    {share.canExport ? " · export" : ""}
                  </p>
                </div>
                <a
                  href={`/admin/forms/${share.formSlug}/sharing`}
                  className="text-xs text-zinc-500 hover:text-zinc-800"
                >
                  Manage
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <button
          type="button"
          disabled={pending}
          onClick={deleteGroup}
          className="text-sm text-red-600 hover:underline"
        >
          Delete group
        </button>
      )}
    </div>
  );
}
