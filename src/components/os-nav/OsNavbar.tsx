"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOutToHome } from "@/app/actions/sign-out";
import {
  OS_DEPARTMENTS,
  OS_ENTITIES,
  OS_ORIGIN,
  OS_TOOLS,
  entityForOrganizationSlug,
  organizationSlugForEntity,
  toolLink,
} from "@/lib/os-catalog";
import { OsIcon } from "./icons";

const THEME_KEY = "theme";
const DEPARTMENT_KEY = "tlb.activeDepartment";
const ENTITY_KEY = "tlb.activeEntity";

type MenuId = "apps" | "department" | "entity" | "account";

type OsNavbarProps = {
  appName: string;
  user: { name: string; email: string } | null;
  isAdmin: boolean;
  organizationSlug: string | null;
  organizationId: string | null;
  canSwitchOrg: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readStored(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

export function OsNavbar({
  appName,
  user,
  isAdmin,
  organizationSlug,
  organizationId,
  canSwitchOrg,
}: OsNavbarProps) {
  const pathname = usePathname();
  const menuId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<MenuId | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [department, setDepartment] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const storedTheme = readStored(THEME_KEY);
    const nextTheme = storedTheme === "light" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);

    const storedDepartment = readStored(DEPARTMENT_KEY);
    if (storedDepartment && OS_DEPARTMENTS.some((item) => item.key === storedDepartment)) {
      setDepartment(storedDepartment);
    }

    const fromOrg = entityForOrganizationSlug(organizationSlug);
    const storedEntity = readStored(ENTITY_KEY);
    const nextEntity =
      storedEntity === "__all__"
        ? null
        : storedEntity && OS_ENTITIES.some((item) => item.key === storedEntity)
          ? storedEntity
          : fromOrg;
    setEntity(nextEntity);
  }, [organizationSlug]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggleMenu(id: MenuId) {
    setOpen((current) => (current === id ? null : id));
  }

  function applyTheme(next: "dark" | "light") {
    const root = document.documentElement.classList;
    root.remove("light", "dark");
    root.add(next);
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    writeStored(THEME_KEY, next);
    setTheme(next);
  }

  function selectDepartment(key: string | null) {
    setDepartment(key);
    writeStored(DEPARTMENT_KEY, key);
    setOpen(null);
  }

  async function selectEntity(key: string | null) {
    setEntity(key);
    writeStored(ENTITY_KEY, key ?? "__all__");
    setOpen(null);
    setSwitchError(null);
    if (!canSwitchOrg) return;

    const slug = organizationSlugForEntity(key);
    if (!slug || slug === organizationSlug) return;

    setSwitching(true);
    try {
      const list = await fetch("/api/admin/platform/organizations");
      if (!list.ok) {
        setSwitchError("Could not load entities.");
        return;
      }
      const data = (await list.json()) as {
        organizations: Array<{ id: string; slug: string }>;
      };
      const match = data.organizations.find((org) => org.slug === slug);
      if (!match || match.id === organizationId) return;

      const response = await fetch("/api/admin/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: match.id }),
      });
      if (!response.ok) {
        setSwitchError("Could not switch entity.");
        return;
      }
      window.location.assign("/admin/forms");
    } catch {
      setSwitchError("Could not switch entity.");
    } finally {
      setSwitching(false);
    }
  }

  const departmentName =
    OS_DEPARTMENTS.find((item) => item.key === department)?.name ?? null;
  const activeEntity = OS_ENTITIES.find((item) => item.key === entity) ?? null;
  const displayName = user?.name || user?.email || "";
  const themeLabel = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  const adminActive = pathname === "/admin" || pathname.startsWith("/admin/");
  const firmKey = entity && entity !== "tlb" ? entity : undefined;

  return (
    <header
      ref={rootRef}
      data-firm={firmKey}
      className="os-nav sticky top-0 z-30 border-b border-border bg-bg-header/90 backdrop-blur-[10px]"
    >
      <div className="flex h-14 w-full items-center gap-4 px-6 lg:px-3">
        <a
          href={OS_ORIGIN}
          className="flex min-w-0 items-center gap-3 text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/tlb-arrow.svg"
            alt="The Launch Box"
            className="block size-[22px] flex-none"
          />
          <span className="truncate font-brand text-xl font-bold italic leading-none tracking-[0.03em]">
            ACCELERATED BY THE LAUNCH BOX
          </span>
        </a>

        <span className="hidden min-w-0 items-center gap-3 md:flex">
          <span className="h-4 w-px flex-none bg-border" aria-hidden="true" />
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {appName}
          </span>
        </span>

        <div className="ml-auto flex flex-none items-center gap-2.5">
          <AppsMenu
            id={`${menuId}-apps`}
            open={open === "apps"}
            entityKey={entity}
            onToggle={() => toggleMenu("apps")}
            onNavigate={() => setOpen(null)}
          />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-bg-raised hover:text-foreground"
          >
            <OsIcon
              name={theme === "light" ? "moon" : "sun"}
              className="size-4"
            />
          </button>

          <FilterMenu
            id={`${menuId}-department`}
            open={open === "department"}
            label="Active department"
            placeholder="All departments"
            valueLabel={departmentName}
            leading={<OsIcon name="users" className="size-3.5 flex-none opacity-60" />}
            options={OS_DEPARTMENTS.map((item) => ({
              value: item.key,
              label: item.name,
            }))}
            value={department}
            allLabel="All departments"
            disabled={switching}
            onToggle={() => toggleMenu("department")}
            onSelect={selectDepartment}
          />

          <FilterMenu
            id={`${menuId}-entity`}
            open={open === "entity"}
            label="Active firm"
            placeholder="All entities"
            valueLabel={activeEntity?.name ?? null}
            leading={
              <span
                aria-hidden="true"
                className="size-2 flex-none rounded-full"
                style={{ background: firmDot(entity) }}
              />
            }
            options={OS_ENTITIES.map((item) => ({
              value: item.key,
              label: item.name,
              dot: item.key,
            }))}
            value={entity}
            allLabel="All entities"
            disabled={switching}
            onToggle={() => toggleMenu("entity")}
            onSelect={(key) => void selectEntity(key)}
          />

          {isAdmin ? (
            <Link
              href="/admin/forms"
              data-active={adminActive ? "true" : undefined}
              className="os-admin flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors"
            >
              <OsIcon name="shield" className="size-3.5" />
              Admin
            </Link>
          ) : (
            <span
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground"
              title="Not an admin"
            >
              Not admin
            </span>
          )}

          {user ? (
            <AccountMenu
              id={`${menuId}-account`}
              open={open === "account"}
              name={displayName}
              email={user.email}
              onToggle={() => toggleMenu("account")}
            />
          ) : (
            <a
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`}
              className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
      {switchError && (
        <p className="px-6 pb-2 text-right font-mono text-[11px] text-negative lg:px-3">
          {switchError}
        </p>
      )}
    </header>
  );
}

function firmDot(key: string | null): string {
  if (key && /^[a-z0-9-]+$/.test(key)) {
    return `var(--firm-${key}-accent, var(--accent))`;
  }
  return "var(--accent)";
}

function AppsMenu({
  id,
  open,
  entityKey,
  onToggle,
  onNavigate,
}: {
  id: string;
  open: boolean;
  entityKey: string | null;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open app switcher"
        onClick={onToggle}
        data-state={open ? "open" : "closed"}
        className="os-apps flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground outline-none transition-colors hover:bg-bg-raised hover:text-foreground"
      >
        <OsIcon name="layout-grid" className="size-4" />
        <span className="hidden sm:inline">Apps</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-labelledby={id}
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-80 rounded-md border border-border bg-card p-1.5 shadow-md"
        >
          <div className="grid max-h-96 grid-cols-2 gap-1 overflow-y-auto">
            {OS_TOOLS.map((tool) => {
              const link = toolLink(tool, entityKey);
              const body = (
                <>
                  <span className="grid size-7 flex-none place-items-center rounded-sm border border-border bg-bg-raised text-primary">
                    <OsIcon name={tool.icon} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {tool.name}
                  </span>
                  {link.external && (
                    <OsIcon
                      name="external-link"
                      className="size-3 flex-none text-muted-foreground"
                    />
                  )}
                </>
              );
              const className =
                "flex cursor-pointer items-center gap-2.5 rounded-sm p-2 text-foreground outline-none hover:bg-accent hover:text-accent-foreground";
              if (link.external) {
                return (
                  <a
                    key={tool.id}
                    role="menuitem"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    onClick={onNavigate}
                  >
                    {body}
                  </a>
                );
              }
              return (
                <Link
                  key={tool.id}
                  role="menuitem"
                  href={link.href}
                  className={className}
                  onClick={onNavigate}
                >
                  {body}
                </Link>
              );
            })}
          </div>
          <div className="my-1 h-px bg-border" />
          <a
            role="menuitem"
            href={OS_ORIGIN}
            className="flex cursor-pointer items-center justify-center rounded-sm px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={onNavigate}
          >
            All apps
          </a>
        </div>
      )}
    </div>
  );
}

function FilterMenu({
  id,
  open,
  label,
  placeholder,
  valueLabel,
  leading,
  options,
  value,
  allLabel,
  disabled,
  onToggle,
  onSelect,
}: {
  id: string;
  open: boolean;
  label: string;
  placeholder: string;
  valueLabel: string | null;
  leading: React.ReactNode;
  options: Array<{ value: string; label: string; dot?: string }>;
  value: string | null;
  allLabel: string;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className="inline-flex h-8 min-w-44 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-xs text-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 data-[placeholder]:text-muted-foreground"
        data-placeholder={valueLabel ? undefined : "true"}
      >
        {leading}
        <span
          className={`min-w-0 flex-1 truncate text-left ${valueLabel ? "" : "text-muted-foreground"}`}
        >
          {valueLabel ?? placeholder}
        </span>
        <OsIcon name="chevron-down" className="size-4 opacity-50" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-72 min-w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <FilterOption
            selected={value === null}
            label={allLabel}
            onSelect={() => onSelect(null)}
          />
          {options.map((option) => (
            <FilterOption
              key={option.value}
              selected={value === option.value}
              label={option.label}
              dot={option.dot}
              onSelect={() => onSelect(option.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterOption({
  selected,
  label,
  dot,
  onSelect,
}: {
  selected: boolean;
  label: string;
  dot?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-left text-xs outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
    >
      <span className="absolute left-2 inline-flex items-center">
        {selected && <OsIcon name="check" className="size-3.5" />}
      </span>
      {dot && (
        <span
          aria-hidden="true"
          className="mr-2 size-2 flex-none rounded-full"
          style={{ background: firmDot(dot) }}
        />
      )}
      {label}
    </button>
  );
}

function AccountMenu({
  id,
  open,
  name,
  email,
  onToggle,
}: {
  id: string;
  open: boolean;
  name: string;
  email: string;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name || "Account menu"}
        onClick={onToggle}
        className="flex items-center gap-2.5 outline-none"
      >
        <span className="hidden font-mono text-xs tracking-[0.03em] text-muted-foreground lg:inline">
          {name}
        </span>
        <span
          className="grid size-8 place-items-center rounded-full text-xs font-bold"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black))",
            color: "var(--accent-foreground)",
          }}
        >
          {initials(name)}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-labelledby={id}
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-48 rounded-md border border-border bg-card p-1 shadow-md"
        >
          <div className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            {email || name}
          </div>
          <form action={signOutToHome}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 font-mono text-[11px] text-destructive outline-none hover:bg-accent"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
