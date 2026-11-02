import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GuideItem = {
  id: string;
  kind: "find" | "tour";
  title: string;
  body: string | null;
  where_label: string | null;
  path: string | null;
  section: string | null; // matches a data-guide="..." spot on the page
  place: "above" | "below" | "center";
  enabled: boolean;
  suggested: boolean;
  highlight_new: boolean;
  platforms: string[];
  sort_order: number;
  updated_at: string;
};

/** Sections the guide can jump to. Add a data-guide="key" on the page, then add it here. */
export const GUIDE_SECTIONS: { key: string; label: string; path: string }[] = [
  { key: "bottom-nav", label: "Bottom tab bar", path: "/" },
  { key: "menu-button", label: "Menu button", path: "/" },
  { key: "fa-row", label: "Home · FA (Free Agency)", path: "/" },
  { key: "live-streams", label: "Home · Live Streams", path: "/" },
  { key: "spring-training", label: "Home · Spring Training", path: "/" },
  { key: "scores", label: "Home · Scores strip", path: "/" },
  { key: "top-nav", label: "Top bar (PC / tablet)", path: "/" },
  { key: "guide-button", label: "Guide button (PC / tablet)", path: "/" },
  { key: "tv-sidebar", label: "TV left bar", path: "/" },
  { key: "install-android", label: "Install page · Android app card", path: "/install" },
  { key: "install-tv", label: "Install page · TV app card", path: "/install" },
];

export const PLATFORMS: { key: string; label: string }[] = [
  { key: "mobile", label: "Phone" },
  { key: "tablet", label: "Tablet" },
  { key: "desktop", label: "PC" },
  { key: "tv", label: "TV" },
  { key: "app", label: "Installed app" },
];

/** A spot is either a data-guide key (like "fa-row") or any CSS selector (starts with . # or [). */
export function findSpot(spot: string | null | undefined): HTMLElement | null {
  if (!spot) return null;
  try {
    return document.querySelector<HTMLElement>(/^[.#\[]/.test(spot) ? spot : `[data-guide="${spot}"]`);
  } catch { return null; }
}

export type Device = "mobile" | "tablet" | "desktop" | "tv";
export function detectDevice(): Device {
  if (typeof window === "undefined") return "desktop";
  try {
    if (localStorage.getItem("tv-mode") === "true" || new URLSearchParams(location.search).get("tv") === "true") return "tv";
  } catch { /* ignore */ }
  if (/SmartTV|SMART-TV|WebOS|Tizen|BRAVIA|CrKey|AFT|Android TV|AndroidTV|MetsXMFanZoneTV|Roku|AppleTV|GoogleTV|VIDAA|HbbTV/i.test(navigator.userAgent)) return "tv";
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}
export function detectInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function useDevice() {
  const [state, set] = useState(() => ({ device: detectDevice(), app: detectInstalledApp() }));
  useEffect(() => {
    const h = () => set({ device: detectDevice(), app: detectInstalledApp() });
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return state;
}

// Used only if the list can't be loaded, so the guide never comes up empty.
const FALLBACK: GuideItem[] = [
  { id: "t1", kind: "tour", title: "Your 5 main tabs", body: "Home, Watch Live, Blog, Games and Feed are always at the bottom. Tap one from any page.", where_label: null, path: null, section: "bottom-nav", place: "above", enabled: true, suggested: false, highlight_new: false, platforms: ["mobile","tablet","desktop","tv","app"], sort_order: 1, updated_at: "" },
  { id: "t2", kind: "tour", title: "Everything else is in the menu", body: "Tap the three lines for Schedule, Scores, Picks, Podcast, Highlights and your account.", where_label: null, path: null, section: "menu-button", place: "below", enabled: true, suggested: false, highlight_new: false, platforms: ["mobile","tablet","desktop","tv","app"], sort_order: 2, updated_at: "" },
  { id: "t3", kind: "tour", title: "Swipe each row sideways", body: "Tap Trades, Signings or Radar, then swipe the cards. Every row on Home works the same way.", where_label: null, path: null, section: "fa-row", place: "below", enabled: true, suggested: false, highlight_new: false, platforms: ["mobile","tablet","desktop","tv","app"], sort_order: 3, updated_at: "" },
];

export function useGuideItems() {
  const { device, app } = useDevice();
  const q = useQuery({
    queryKey: ["guide-items"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GuideItem[]> => {
      const { data, error } = await supabase
        .from("guide_items" as never)
        .select("*")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      if (error || !data?.length) return FALLBACK;
      return data as unknown as GuideItem[];
    },
  });
  const data = (q.data || []).filter((i) => !i.platforms || i.platforms.includes(device) || (app && i.platforms.includes("app")));
  return { ...q, data, device, app };
}

/** Everything, for the admin editor. */
export type { GuideItem as GuideRow };
