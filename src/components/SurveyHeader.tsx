"use client";

import Link from "next/link";
import { LaunchBoxWordmark } from "@/components/LaunchBoxWordmark";
import { useSurveyTheme } from "@/components/SurveyThemeProvider";

type SurveyHeaderProps = {
  title: string;
  subtitle?: string;
  showHomeLink?: boolean;
};

export function SurveyHeader({
  title,
  subtitle = "Survey",
  showHomeLink = true,
}: SurveyHeaderProps) {
  const theme = useSurveyTheme();

  return (
    <header
      className="border-b"
      style={{
        borderColor: "var(--theme-border)",
        backgroundColor: "var(--theme-surface)",
        color: "var(--theme-text)",
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <LaunchBoxWordmark className="shrink-0" />
        <div className="flex min-w-0 items-center justify-end gap-4">
          {theme.logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.logoSrc}
              alt={theme.logoAlt}
              height={theme.logoHeight}
              className="hidden h-auto w-auto shrink-0 object-contain sm:block"
              style={{ maxHeight: theme.logoHeight, maxWidth: 140 }}
            />
          )}
          <div className="min-w-0 text-right max-sm:sr-only">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {subtitle}
            </p>
            <h1
              className="truncate font-sans text-sm font-semibold normal-case tracking-normal"
              style={{ color: "var(--theme-text)" }}
            >
              {title}
            </h1>
          </div>
          {showHomeLink && (
            <Link
              href="/"
              className="shrink-0 text-sm transition hover:opacity-80"
              style={{ color: "var(--theme-text-muted)" }}
            >
              Home
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
