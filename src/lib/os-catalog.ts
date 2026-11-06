/**
 * Shell catalog mirrored from the production TLB OS bundle
 * (os.thelaunchbox.com). External URLs are the ones baked into that build;
 * tools without a public URL open inside the OS.
 */

export const OS_ORIGIN = "https://os.thelaunchbox.com";

export type OsDepartment = {
  key: string;
  name: string;
};

export type OsEntity = {
  key: string;
  name: string;
  /** Polly organization slug, when this firm is a tenant in this app. */
  organizationSlug: string;
};

export type OsTool = {
  id: string;
  name: string;
  icon: string;
  /** Absolute URL. Omitted tools live at /tools/:id on the OS. */
  url?: string;
  firmScope: "none" | "client" | "server";
};

/**
 * Department and firm labels from the OS workspace payload
 * (os.thelaunchbox.com navbar). Order and spelling match that dropdown.
 */
export const OS_DEPARTMENTS: OsDepartment[] = [
  { key: "finance", name: "Finance" },
  { key: "marketing", name: "Marketing" },
  { key: "peopleops", name: "PeopleOps" },
];

export const OS_ENTITIES: OsEntity[] = [
  { key: "tlb", name: "TLB", organizationSlug: "the-launch-box" },
  { key: "echelon", name: "Echelon", organizationSlug: "echelon" },
  { key: "improv", name: "Improv", organizationSlug: "improvizations" },
  { key: "hyperscayle", name: "Hyperscayle", organizationSlug: "hyperscayle" },
  { key: "dx-foundation", name: "DX Foundation", organizationSlug: "dx-foundation" },
  { key: "vescape-labs", name: "VEscape Labs", organizationSlug: "vescape-labs" },
  { key: "bluetrail", name: "Blue Trail", organizationSlug: "bluetrail-digital" },
];

export const OS_TOOLS: OsTool[] = [
  { id: "expense-tracker", name: "Expense Tracker", icon: "receipt-text", firmScope: "client" },
  { id: "cashflow", name: "Cashflow", icon: "trending-up", firmScope: "server" },
  { id: "payroll-variance", name: "Payroll Variance", icon: "balance-scale", firmScope: "none" },
  { id: "reimbursements", name: "Reimbursements", icon: "wallet", firmScope: "server" },
  { id: "piw-pricing", name: "CPQ", icon: "calculator", firmScope: "server" },
  { id: "piw-admin", name: "CPQ Admin", icon: "calculator", firmScope: "none" },
  { id: "late-timesheets", name: "Late Timesheets", icon: "clock-alert", firmScope: "none" },
  { id: "cost-rate-calculator", name: "Cost Rate Calculator", icon: "landmark", firmScope: "none" },
  { id: "deal-desk", name: "Deal Desk", icon: "handshake", firmScope: "server" },
  { id: "invoicing", name: "Invoicing Tracker", icon: "file-text", firmScope: "server" },
  { id: "procurement", name: "Procurement", icon: "clipboard-check", url: "https://procurement.os.thelaunchbox.com", firmScope: "none" },
  { id: "sql-scheduler", name: "SQL Scheduler", icon: "database", url: "https://finapp.thelaunchbox.com", firmScope: "none" },
  { id: "kantata-sync", name: "Kantata Sync", icon: "users", firmScope: "none" },
  { id: "rate-comparison", name: "Rate Comparison", icon: "balance-scale", firmScope: "server" },
  { id: "commissions", name: "Commissions", icon: "percent", url: "https://commissions.os.thelaunchbox.com", firmScope: "client" },
  { id: "project-intake", name: "Project Intake System", icon: "inbox", url: "https://requests.os.thelaunchbox.com", firmScope: "none" },
  { id: "job-requisition", name: "Job Requisition Manager", icon: "briefcase", url: "https://victorious-ocean-03340e810.7.azurestaticapps.net", firmScope: "none" },
  { id: "automation-hub", name: "Automation Hub", icon: "workflow", firmScope: "client" },
  { id: "echelon-automation-hub", name: "Echelon Automation Hub", icon: "workflow", url: "https://black-wave-0e7a7d50f.7.azurestaticapps.net", firmScope: "none" },
  { id: "automation-status", name: "Automation Status", icon: "activity", url: "https://victorious-flower-0e8a3e60f.6.azurestaticapps.net", firmScope: "none" },
  { id: "mail-agent", name: "Mail Agent", icon: "mailbox", url: "https://kenzie-mail-agent.azurewebsites.net/login?next=/", firmScope: "none" },
  { id: "strategic-initiatives", name: "Strategic Initiatives", icon: "target", url: "https://wonderful-river-0ad260c10.1.azurestaticapps.net/", firmScope: "none" },
  { id: "people-ops", name: "People Ops Scorecard", icon: "users", firmScope: "none" },
  { id: "capacity-planner", name: "Capacity & Leverage Planner", icon: "gauge", firmScope: "server" },
  { id: "kantata-import", name: "Kantata Plan Import", icon: "calendar-range", firmScope: "server" },
  { id: "emof-agent", name: "EMOF Agent", icon: "megaphone", url: "https://func-tlb-earned-media.azurewebsites.net/auth/callback", firmScope: "none" },
  { id: "polly", name: "Polly", icon: "send", firmScope: "none" },
];

export function entityForOrganizationSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return OS_ENTITIES.find((entity) => entity.organizationSlug === slug)?.key ?? null;
}

export function organizationSlugForEntity(key: string | null): string | null {
  if (!key) return null;
  return OS_ENTITIES.find((entity) => entity.key === key)?.organizationSlug ?? null;
}

export function toolLink(
  tool: OsTool,
  entityKey: string | null,
): { href: string; external: boolean } {
  if (tool.id === "polly") {
    return { href: "/", external: false };
  }

  const base = tool.url ?? `${OS_ORIGIN}/tools/${tool.id}`;
  if (tool.firmScope !== "client" || !entityKey) {
    return { href: base, external: true };
  }

  try {
    const url = new URL(base);
    url.searchParams.set("entity", entityKey);
    return { href: url.toString(), external: true };
  } catch {
    return { href: base, external: true };
  }
}
