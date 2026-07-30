"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  sharedFormCount: number;
};

export function GroupsManager({
  initialGroups,
  canManage,
}: {
  initialGroups: GroupRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createGroup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        id?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "Could not create group.");
        return;
      }
      setName("");
      if (data?.id) {
        router.push(`/admin/groups/${data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <form
          onSubmit={createGroup}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4"
        >
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700">New group</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Marketing team"
              className="rounded-lg border border-zinc-300 px-3 py-2"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Create
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}

      {initialGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No groups yet.
          {canManage
            ? " Create one to share surveys with a team."
            : " Ask a manager to create groups."}
        </div>
      ) : (
        <div className="space-y-3">
          {initialGroups.map((group) => (
            <Link
              key={group.id}
              href={`/admin/groups/${group.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400"
            >
              <div>
                <p className="font-medium text-zinc-900">{group.name}</p>
                <p className="text-sm text-zinc-500">
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"} ·{" "}
                  {group.sharedFormCount} shared survey
                  {group.sharedFormCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-zinc-400">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
