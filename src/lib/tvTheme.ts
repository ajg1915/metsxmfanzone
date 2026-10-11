import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// TV app colours. Admin › TV App Colours picks Day, Night or Automatic (by the TV's clock) and can
// change each colour. Day = the normal MetsXMFanZone colours; Night = grey, blue and orange.
export const TV_THEME_KEY = "tv_theme";

export const TV_COLOR_FIELDS = [
  { key: "bg", label: "Background" },
  { key: "card", label: "Top bar and cards" },
  { key: "surface", label: "Buttons and tiles" },
  { key: "text", label: "Text" },
  { key: "subtext", label: "Small text" },
  { key: "accent", label: "Orange (highlights)" },
  { key: "highlight", label: "Blue" },
] as const;

export type TVColorKey = (typeof TV_COLOR_FIELDS)[number]["key"];
export type TVPalette = Record<TVColorKey, string>;
export type TVThemeMode = "auto" | "day" | "night";

export interface TVThemeSettings {
  mode: TVThemeMode;
  /** "HH:MM", 24-hour, on the TV's own clock. */
  dayStart: string;
  nightStart: string;
  day: TVPalette;
  night: TVPalette;
}

export const DEFAULT_DAY: TVPalette = {
  bg: "#07101f",
  card: "#0f1b30",
  surface: "#17263f",
  text: "#f2f5fa",
  subtext: "#9fb0c9",
  accent: "#ff5910",
  highlight: "#0b3b75",
};

export const DEFAULT_NIGHT: TVPalette = {
  bg: "#16191f",
  card: "#20252d",
  surface: "#2c323c",
  text: "#e9ecf1",
  subtext: "#a3acb9",
  accent: "#ff6a1f",
  highlight: "#3568b8",
};

export const DEFAULT_TV_THEME: TVThemeSettings = {
  mode: "auto",
  dayStart: "06:00",
  nightStart: "19:00",
  day: DEFAULT_DAY,
  night: DEFAULT_NIGHT,
};

export function withDefaults(raw: Partial<TVThemeSettings> | null | undefined): TVThemeSettings {
  return {
    ...DEFAULT_TV_THEME,
    ...(raw ?? {}),
    day: { ...DEFAULT_DAY, ...(raw?.day ?? {}) },
    night: { ...DEFAULT_NIGHT, ...(raw?.night ?? {}) },
  };
}

export function useTVThemeSettings(enabled = true) {
  return useQuery({
    queryKey: ["tv-theme"],
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: enabled ? 10 * 60_000 : false,
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", TV_THEME_KEY)
        .maybeSingle();
      return withDefaults(data?.setting_value as Partial<TVThemeSettings> | null);
    },
  });
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Which look is on right now. */
export function currentTVLook(s: TVThemeSettings, now = new Date()): "day" | "night" {
  if (s.mode !== "auto") return s.mode;
  const t = now.getHours() * 60 + now.getMinutes();
  const day = minutes(s.dayStart);
  const night = minutes(s.nightStart);
  const isDay = day <= night ? t >= day && t < night : !(t >= night && t < day);
  return isDay ? "day" : "night";
}

/** "#rrggbb" → "h s% l%" for the site's hsl(var(--x)) colours. */
function hexToHsl(hex: string): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const SITE_VARS = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--muted", "--muted-foreground", "--secondary", "--accent", "--primary", "--ring", "--menu-panel",
  "--menu-panel-foreground", "--sidebar-background", "--mets-blue", "--mets-blue-dark", "--mets-orange",
];
const TV_VARS = TV_COLOR_FIELDS.map((f) => `--tv-${f.key}`).concat("--tv-hero");

/** Paint the TV app (TV home and every page opened in TV mode) with a palette. */
export function applyTVPalette(p: TVPalette, look: "day" | "night") {
  const st = document.documentElement.style;
  TV_COLOR_FIELDS.forEach((f) => st.setProperty(`--tv-${f.key}`, p[f.key]));
  st.setProperty("--tv-hero", look === "night" ? p.card : "#0a1d3d");
  const site: Record<string, string> = {
    "--background": p.bg,
    "--foreground": p.text,
    "--card": p.card,
    "--card-foreground": p.text,
    "--popover": p.card,
    "--popover-foreground": p.text,
    "--muted": p.surface,
    "--muted-foreground": p.subtext,
    "--secondary": p.highlight,
    "--accent": p.highlight,
    "--primary": p.accent,
    "--ring": p.accent,
    "--menu-panel": p.bg,
    "--menu-panel-foreground": p.text,
    "--sidebar-background": p.bg,
    "--mets-blue": p.highlight,
    "--mets-blue-dark": p.bg,
    "--mets-orange": p.accent,
  };
  Object.entries(site).forEach(([k, v]) => st.setProperty(k, hexToHsl(v)));
  document.documentElement.dataset.tvLook = look;
}

/** Undo applyTVPalette (when TV mode turns off). */
export function clearTVPalette() {
  const st = document.documentElement.style;
  [...SITE_VARS, ...TV_VARS].forEach((k) => st.removeProperty(k));
  delete document.documentElement.dataset.tvLook;
}
