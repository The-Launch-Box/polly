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
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        >
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">New group</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Marketing team"
              className="rounded-lg border border-border px-3 py-2"
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent-soft disabled:opacity-60"
          >
            Create
          </button>
          {error && <p className="w-full text-sm text-negative">{error}</p>}
        </form>
      )}

      {initialGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
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
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-muted-foreground"
            >
              <div>
                <p className="font-medium text-foreground">{group.name}</p>
                <p className="text-sm text-muted-foreground">
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"} ·{" "}
                  {group.sharedFormCount} shared survey
                  {group.sharedFormCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-fg-faint">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
