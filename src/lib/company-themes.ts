/**
 * Premade survey themes derived from marketing-themes/ brand assets
 * (email signatures, logo SVGs, and brand guidelines).
 */

export type CompanyTheme = {
  id: string;
  name: string;
  company: string;
  website: string;
  logoSrc: string | null;
  logoAlt: string;
  logoHeight: number;
  fontFamily: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    progressTrack: string;
    /** Text on primary-colored buttons (defaults to white). */
    primaryForeground?: string;
  };
};

export const DEFAULT_THEME_ID = "default";

export const COMPANY_THEMES: CompanyTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    name: "Neutral (no brand)",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: null,
    logoAlt: "",
    logoHeight: 0,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#18181b",
      accent: "#3f3f46",
      background: "#fafafa",
      surface: "#ffffff",
      text: "#18181b",
      textMuted: "#71717a",
      border: "#e4e4e7",
      progressTrack: "#e4e4e7",
    },
  },
  {
    id: "launch-box-cyan",
    name: "The Launch Box — Cyan",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: "/company-themes/launch-box.png",
    logoAlt: "The Launch Box",
    logoHeight: 30,
    // Cyan shell with black text + black logo; brand rocket orange (#f0541e) as accent
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#000000",
      accent: "#f0541e",
      background: "#06b6d4",
      surface: "#22d3ee",
      text: "#000000",
      textMuted: "#0e5561",
      border: "#0891b2",
      progressTrack: "#0e7490",
      primaryForeground: "#ffffff",
    },
  },
  {
    id: "launch-box-white",
    name: "The Launch Box — White",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: "/company-themes/launch-box.png",
    logoAlt: "The Launch Box",
    logoHeight: 30,
    // Clean white shell with black text + black logo; brand rocket orange (#f0541e) as accent
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#000000",
      accent: "#f0541e",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#000000",
      textMuted: "#52525b",
      border: "#e4e4e7",
      progressTrack: "#e4e4e7",
      primaryForeground: "#ffffff",
    },
  },
  {
    id: "launch-box-black",
    name: "The Launch Box — Black",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: "/company-themes/launch-box-white.png",
    logoAlt: "The Launch Box",
    logoHeight: 30,
    // Black shell with white text + white logo; brand rocket orange (#f0541e) as accent
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#ffffff",
      accent: "#f0541e",
      background: "#000000",
      surface: "#111111",
      text: "#ffffff",
      textMuted: "#a1a1aa",
      border: "#27272a",
      progressTrack: "#27272a",
      primaryForeground: "#000000",
    },
  },
  {
    id: "echelon",
    name: "Echelon Risk + Cyber",
    company: "Echelon",
    website: "echeloncyber.com",
    logoSrc: "/company-themes/echelon.svg",
    logoAlt: "Echelon Risk + Cyber",
    logoHeight: 32,
    // Brand lime #e0ff00 (Echelon Glitch Yellow) on dark navy shell
    fontFamily:
      '"Franklin Gothic Medium", "ITC Franklin Gothic", Arial, sans-serif',
    colors: {
      primary: "#e0ff00",
      accent: "#e0ff00",
      background: "#03032e",
      surface: "#0c0c42",
      text: "#e0ff00",
      textMuted: "#b8c94d",
      border: "#1e1e5c",
      progressTrack: "#1e1e5c",
      primaryForeground: "#03032e",
    },
  },
  {
    id: "improv",
    name: "Improvizations",
    company: "Improv",
    website: "improvizations.com",
    logoSrc: "/company-themes/improv.svg",
    logoAlt: "Improvizations",
    logoHeight: 28,
    // Email sig: Helvetica Neue, accent link #cc3366, divider #e8e3df
    fontFamily:
      '"Helvetica Neue", Helvetica, Arial, sans-serif',
    colors: {
      primary: "#000000",
      accent: "#cc3366",
      background: "#faf9f8",
      surface: "#ffffff",
      text: "#000000",
      textMuted: "#5c5c5c",
      border: "#e8e3df",
      progressTrack: "#e8e3df",
    },
  },
  {
    id: "blue-trail-digital",
    name: "Blue Trail Digital",
    company: "Blue Trail Digital",
    website: "bluetraildigital.com",
    logoSrc: "/company-themes/blue-trail-digital.svg",
    logoAlt: "Blue Trail Digital",
    logoHeight: 36,
    // Logo SVG: charcoal #161615 + trail marker #00dbff
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#00dbff",
      accent: "#00dbff",
      background: "#161615",
      surface: "#1f1f1e",
      text: "#f5f5f4",
      textMuted: "#a8a29e",
      border: "#3d3d3b",
      progressTrack: "#3d3d3b",
    },
  },
  {
    id: "dx-foundation",
    name: "DX Foundation",
    company: "DX Foundation",
    website: "dxfoundation.com",
    logoSrc: "/company-themes/dx-foundation.svg",
    logoAlt: "DX Foundation",
    logoHeight: 40,
    // Logo SVG: logomark #f02d57, wordmark #05010b
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    colors: {
      primary: "#f02d57",
      accent: "#f02d57",
      background: "#05010b",
      surface: "#0f0a14",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      border: "#27203a",
      progressTrack: "#27203a",
    },
  },
  {
    id: "vescape-labs",
    name: "VEscape Labs",
    company: "VEscape Labs",
    website: "vescapelabs.com",
    logoSrc: "/company-themes/vescape-labs.svg",
    logoAlt: "VEscape Labs",
    logoHeight: 32,
    // Email sig: Roboto italic headings, purple #330066, logo accent #ff0066
    fontFamily: 'Roboto, "Franklin Gothic Medium", Arial, sans-serif',
    colors: {
      primary: "#330066",
      accent: "#ff0066",
      background: "#faf8fc",
      surface: "#ffffff",
      text: "#1a1a1a",
      textMuted: "#5c4d6e",
      border: "#e8e0f0",
      progressTrack: "#e8e0f0",
    },
  },
  {
    id: "hyperscayle",
    name: "Hyperscayle",
    company: "Hyperscayle",
    website: "hyperscayle.com",
    logoSrc: "/company-themes/hyperscayle.png",
    logoAlt: "Hyperscayle",
    logoHeight: 36,
    // Email sig: Roboto, deep navy #0b105b
    fontFamily:
      'Roboto, "Franklin Gothic Medium", Arial, sans-serif',
    colors: {
      primary: "#0b105b",
      accent: "#0b105b",
      background: "#f5f6fa",
      surface: "#ffffff",
      text: "#0b105b",
      textMuted: "#4a5080",
      border: "#d8dbe8",
      progressTrack: "#d8dbe8",
    },
  },
];

const THEME_BY_ID = new Map(COMPANY_THEMES.map((theme) => [theme.id, theme]));

export const COMPANY_THEME_IDS = COMPANY_THEMES.map((theme) => theme.id);

export function getCompanyTheme(themeId: string | null | undefined): CompanyTheme {
  if (!themeId) {
    return THEME_BY_ID.get(DEFAULT_THEME_ID)!;
  }
  return THEME_BY_ID.get(themeId) ?? THEME_BY_ID.get(DEFAULT_THEME_ID)!;
}

export function themeCssVariables(theme: CompanyTheme): Record<string, string> {
  return {
    ["--theme-primary" as string]: theme.colors.primary,
    ["--theme-accent" as string]: theme.colors.accent,
    ["--theme-bg" as string]: theme.colors.background,
    ["--theme-surface" as string]: theme.colors.surface,
    ["--theme-text" as string]: theme.colors.text,
    ["--theme-text-muted" as string]: theme.colors.textMuted,
    ["--theme-border" as string]: theme.colors.border,
    ["--theme-progress-track" as string]: theme.colors.progressTrack,
    ["--theme-primary-foreground" as string]:
      theme.colors.primaryForeground ?? "#ffffff",
    fontFamily: theme.fontFamily,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  };
}
