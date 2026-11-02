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
  place: "above" | "below" | "center" | "top" | "bottom";
  enabled: boolean;
  suggested: boolean;
  highlight_new: boolean;
  platforms: string[];
  sort_order: number;
  updated_at: string;
};

/** Sections the guide can jump to. Add a data-guide="key" on the page, then add it here. */
export const GUIDE_SECTIONS: { key: string; label: string; path: string; group: string }[] = [
  { group: "Home sections", key: "home-hero", label: "Hero (top banner)", path: "/" },
  { group: "Home sections", key: "hero-watch", label: "Hero · Watch Live button (signed in)", path: "/" },
  { group: "Home sections", key: "hero-reminder", label: "Hero · Reminder bell (signed in)", path: "/" },
  { group: "Home sections", key: "trial-banner", label: "Free trial banner", path: "/" },
  { group: "Home sections", key: "fa-row", label: "FA (Free Agency)", path: "/" },
  { group: "Home sections", key: "fa-tabs", label: "FA · Trades / Signings / Radar tabs", path: "/" },
  { group: "Home sections", key: "gamecast", label: "Game Center banner", path: "/" },
  { group: "Home sections", key: "live-streams", label: "Live Streams", path: "/" },
  { group: "Home sections", key: "spring-training", label: "Spring Training", path: "/" },
  { group: "Home sections", key: "spring-watch-live", label: "Spring Training · Watch live link", path: "/" },
  { group: "Home sections", key: "scores", label: "Scores strip", path: "/" },
  { group: "Home sections", key: "game-series", label: "Game Series", path: "/" },
  { group: "Home sections", key: "sports-networks", label: "Included Premium Services (TV mode strip)", path: "/" },
  { group: "Home sections", key: "plans", label: "Plans (phone visitors)", path: "/" },
  { group: "Home sections", key: "related-streams", label: "Included Premium Services", path: "/" },
  { group: "Home sections", key: "blog", label: "Latest articles (Blog)", path: "/" },
  { group: "Home sections", key: "podcast", label: "Podcasts", path: "/" },
  { group: "Home sections", key: "app-install", label: "Get the app (PC / tablet)", path: "/" },
  { group: "Home sections", key: "phone-join", label: "Join card (phone visitors)", path: "/" },
  { group: "Home sections", key: "newsletter", label: "Newsletter signup", path: "/" },
  { group: "Home sections", key: "app-strip", label: "Get the app strip (signed out)", path: "/" },
  { group: "Home sections", key: "footer", label: "Footer", path: "/" },
  { group: "Phone bottom tabs", key: "bottom-nav", label: "All 5 tabs", path: "/" },
  { group: "Phone bottom tabs", key: "tab-home", label: "Home tab", path: "/" },
  { group: "Phone bottom tabs", key: "tab-watch-live", label: "Watch Live tab", path: "/" },
  { group: "Phone bottom tabs", key: "tab-blog", label: "Blog tab", path: "/" },
  { group: "Phone bottom tabs", key: "tab-games", label: "Games tab", path: "/" },
  { group: "Phone bottom tabs", key: "tab-feed", label: "Feed tab", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-button", label: "Menu button (three lines)", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-watch-live", label: "Watch Live button", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-schedule", label: "Schedule", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-scores", label: "Scores", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-game-center", label: "Game Center", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-picks", label: "Picks", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-blog", label: "Blog", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-podcast", label: "Podcast", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-community", label: "Community (signed in)", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-dashboard", label: "Dashboard (signed in)", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-get-the-app", label: "Get the app (signed in)", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-how-to-get-around", label: "How to get around (signed in)", path: "/" },
  { group: "Phone menu (opens by itself)", key: "menu-tv-mode", label: "TV Mode (members)", path: "/" },
  { group: "PC / tablet top bar", key: "top-nav", label: "Whole top bar", path: "/" },
  { group: "PC / tablet top bar", key: "nav-home", label: "Home", path: "/" },
  { group: "PC / tablet top bar", key: "nav-community", label: "Community", path: "/" },
  { group: "PC / tablet top bar", key: "nav-podcast", label: "Podcast", path: "/" },
  { group: "PC / tablet top bar", key: "nav-blog", label: "Blog", path: "/" },
  { group: "PC / tablet top bar", key: "nav-mets", label: "Mets menu", path: "/" },
  { group: "PC / tablet top bar", key: "nav-pricing", label: "Pricing (signed out)", path: "/" },
  { group: "PC / tablet top bar", key: "nav-tv-mode", label: "TV Mode (members)", path: "/" },
  { group: "PC / tablet top bar", key: "nav-account", label: "Account menu (signed in)", path: "/" },
  { group: "PC / tablet top bar", key: "guide-button", label: "What's new button", path: "/" },
  { group: "TV", key: "tv-sidebar", label: "TV left bar", path: "/" },
  { group: "Install page", key: "install-android", label: "Android app button", path: "/install" },
  { group: "Install page", key: "install-tv", label: "TV app button", path: "/install" },
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
