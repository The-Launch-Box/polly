"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type OrgOption = {
  id: string;
  name: string;
  slug: string;
  emailDomain: string;
};

export function OrgSwitcher({
  activeOrganizationId,
}: {
  activeOrganizationId: string;
}) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [value, setValue] = useState(activeOrganizationId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/platform/organizations");
      if (!response.ok) return;
      const data = (await response.json()) as {
        organizations: OrgOption[];
        activeOrganizationId: string;
      };
      if (!cancelled) {
        setOrganizations(data.organizations);
        setValue(data.activeOrganizationId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(organizationId: string) {
    setValue(organizationId);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not switch organization.");
        return;
      }
      router.refresh();
      window.location.assign("/admin/forms");
    });
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="hidden sm:inline">Org</span>
        <select
          className="max-w-[12rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800"
          value={value}
          disabled={pending}
          onChange={(event) => onChange(event.target.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
