"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={
        active
          ? "font-medium text-tlb-orange"
          : "text-muted-foreground transition-colors hover:text-foreground"
      }
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
