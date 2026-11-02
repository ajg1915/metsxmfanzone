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
];

// Used only if the list can't be loaded, so the guide never comes up empty.
const FALLBACK: GuideItem[] = [
  { id: "t1", kind: "tour", title: "Your 5 main tabs", body: "Home, Watch Live, Blog, Games and Feed are always at the bottom. Tap one from any page.", where_label: null, path: null, section: "bottom-nav", place: "above", enabled: true, suggested: false, highlight_new: false, sort_order: 1, updated_at: "" },
  { id: "t2", kind: "tour", title: "Everything else is in the menu", body: "Tap the three lines for Schedule, Scores, Picks, Podcast, Highlights and your account.", where_label: null, path: null, section: "menu-button", place: "below", enabled: true, suggested: false, highlight_new: false, sort_order: 2, updated_at: "" },
  { id: "t3", kind: "tour", title: "Swipe each row sideways", body: "Tap Trades, Signings or Radar, then swipe the cards. Every row on Home works the same way.", where_label: null, path: null, section: "fa-row", place: "below", enabled: true, suggested: false, highlight_new: false, sort_order: 3, updated_at: "" },
];

export function useGuideItems() {
  return useQuery({
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
}
