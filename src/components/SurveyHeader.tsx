"use client";

import { useSurveyTheme } from "@/components/SurveyThemeProvider";

type SurveyHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SurveyHeader({
  title,
  subtitle = "Survey",
}: SurveyHeaderProps) {
  const theme = useSurveyTheme();

  return (
    <header
      className="border-b"
      style={{
        borderColor: "var(--theme-border)",
        backgroundColor: "var(--theme-surface)",
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {theme.logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={theme.logoSrc}
              alt={theme.logoAlt}
              height={theme.logoHeight}
              className="h-auto w-auto shrink-0 object-contain"
              style={{ maxHeight: theme.logoHeight, maxWidth: 180 }}
            />
          )}
          <div className="min-w-0">
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {subtitle}
            </p>
            <h1
              className="truncate text-lg font-semibold"
              style={{ color: "var(--theme-text)" }}
            >
              {title}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
}
