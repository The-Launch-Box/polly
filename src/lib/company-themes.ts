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

const TLB_SANS =
  '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** Dark operating surface shared with os.thelaunchbox.com. */
const TLB_DARK_COLORS: CompanyTheme["colors"] = {
  primary: "#FF6600",
  accent: "#FF844D",
  background: "#0d1117",
  surface: "#161b22",
  text: "#f0f6fc",
  textMuted: "#8b949e",
  border: "#30363d",
  progressTrack: "#21262d",
  primaryForeground: "#ffffff",
};

export const COMPANY_THEMES: CompanyTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    name: "The Launch Box",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: null,
    logoAlt: "",
    logoHeight: 0,
    fontFamily: TLB_SANS,
    colors: TLB_DARK_COLORS,
  },
  {
    id: "launch-box-cyan",
    name: "The Launch Box (Dark)",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: null,
    logoAlt: "The Launch Box",
    logoHeight: 0,
    fontFamily: TLB_SANS,
    colors: TLB_DARK_COLORS,
  },
  {
    id: "launch-box-white",
    name: "The Launch Box (Light)",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: null,
    logoAlt: "The Launch Box",
    logoHeight: 0,
    fontFamily: TLB_SANS,
    colors: {
      primary: "#FF6600",
      accent: "#FF6600",
      background: "#ffffff",
      surface: "#ffffff",
      text: "#000000",
      textMuted: "#1A1A1A",
      border: "#E5E5E5",
      progressTrack: "#E5E5E5",
      primaryForeground: "#ffffff",
    },
  },
  {
    id: "launch-box-black",
    name: "The Launch Box (Black)",
    company: "The Launch Box",
    website: "thelaunchbox.com",
    logoSrc: null,
    logoAlt: "The Launch Box",
    logoHeight: 0,
    fontFamily: TLB_SANS,
    colors: {
      primary: "#FF6600",
      accent: "#FF844D",
      background: "#000000",
      surface: "#1A1A1A",
      text: "#ffffff",
      textMuted: "#F5F5F5",
      border: "#1A1A1A",
      progressTrack: "#1A1A1A",
      primaryForeground: "#ffffff",
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

function colorSchemeFor(background: string): "dark" | "light" {
  const hex = background.trim().replace("#", "");
  if (hex.length !== 6) return "light";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return "light";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.55 ? "dark" : "light";
}

export function themeCssVariables(
  theme: CompanyTheme,
): Record<string, string> {
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
    colorScheme: colorSchemeFor(theme.colors.background),
  };
}
