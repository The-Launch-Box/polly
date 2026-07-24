"use client";

import {
  COMPANY_THEMES,
  getCompanyTheme,
  type CompanyTheme,
} from "@/lib/company-themes";

type ThemePickerProps = {
  value: string;
  onChange: (themeId: string) => void;
  error?: string;
};

export function ThemePicker({ value, onChange, error }: ThemePickerProps) {
  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          Company theme template
        </span>
        <p className="mt-1 text-xs text-zinc-500">
          Applies brand colors, typography, and logo to the live survey.
        </p>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 ${
            error ? "border-red-300" : "border-zinc-300"
          }`}
        >
          {COMPANY_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <ThemePreview theme={getCompanyTheme(value)} />
    </div>
  );
}

function ThemePreview({ theme }: { theme: CompanyTheme }) {
  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border border-zinc-200"
      style={{
        backgroundColor: theme.colors.background,
        fontFamily: theme.fontFamily,
      }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        {theme.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme.logoSrc}
            alt={theme.logoAlt}
            className="h-auto object-contain"
            style={{ maxHeight: theme.logoHeight, maxWidth: 140 }}
          />
        ) : (
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: theme.colors.textMuted }}
          >
            No logo
          </span>
        )}
        <span
          className="text-sm font-semibold"
          style={{ color: theme.colors.text }}
        >
          Preview
        </span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
          Sample question prompt
        </p>
        <div className="flex gap-2">
          <span
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.primaryForeground ?? "#ffffff",
            }}
          >
            Selected
          </span>
          <span
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: theme.colors.border,
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
            }}
          >
            Option
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.progressTrack }}
        >
          <div
            className="h-full w-2/5 rounded-full"
            style={{ backgroundColor: theme.colors.primary }}
          />
        </div>
        <p className="text-xs" style={{ color: theme.colors.accent }}>
          {theme.website}
        </p>
      </div>
    </div>
  );
}
