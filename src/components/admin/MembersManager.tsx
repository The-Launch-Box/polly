"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrgRole } from "@/generated/prisma/client";

type MemberRow = {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  platformRole: string | null;
};

export function MembersManager({
  initialMembers,
  assignableRoles,
  currentUserId,
}: {
  initialMembers: MemberRow[];
  assignableRoles: OrgRole[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeRole(userId: string, role: OrgRole) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not update role.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {initialMembers.map((member) => (
              <tr key={member.userId} className="border-b border-zinc-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">
                    {member.name ?? member.email}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-zinc-400">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-zinc-500">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                    value={member.role}
                    disabled={pending || member.userId === currentUserId}
                    onChange={(event) =>
                      changeRole(member.userId, event.target.value as OrgRole)
                    }
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">How promotion works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Users join automatically on first Microsoft sign-in with an org email
            (role defaults to <strong>Creator</strong>).
          </li>
          <li>
            <strong>Owner</strong> can set anyone to Creator, Manager, Admin, or
            transfer Ownership.
          </li>
          <li>
            <strong>Admin</strong> can promote to Creator or Manager only.
          </li>
          <li>
            <strong>Manager</strong> can create groups and share surveys; they
            do not promote users.
          </li>
        </ul>
      </div>
    </div>
  );
}
