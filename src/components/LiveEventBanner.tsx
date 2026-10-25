import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// "LIVE NOW" banner for every game/event. Always-on feeds never show it.
const ALWAYS_ON = ["sny-tv", "metsxmfanzone-2", "metsxmfanzone"];
const PLATFORMS: Record<string, { name: string; path: string }> = {
  "mlb-network": { name: "Apple TV", path: "/apple-tv" },
  "espn-network": { name: "Prime Video", path: "/prime-video" },
  "msg-network": { name: "Peacock", path: "/peacock" },
};
const WINDOW_MS = 6 * 60 * 60 * 1000;
const DISMISS_KEY = "mxf_live_banner_dismissed";

interface LiveEvent {
  id: string;
  title: string | null;
  assigned_pages: string[] | null;
  actual_start: string | null;
  scheduled_start: string | null;
  offline_loop?: boolean | null;
}

const readDismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function LiveEventBanner() {
  const { pathname } = useLocation();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const hidden = pathname.startsWith("/admin") || pathname.startsWith("/tv");

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      const { data } = await (supabase as any)
        .from(session.session ? "live_streams" : "live_streams_public")
        .select("id, title, assigned_pages, actual_start, scheduled_start, offline_loop")
        .eq("status", "live")
        .order("actual_start", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const now = Date.now();
      const next = ((data || []) as LiveEvent[]).find((s) => {
        const pages = s.assigned_pages || [];
        if (s.offline_loop) return false;
        if (pages.some((p) => ALWAYS_ON.includes(p))) return false;
        const started = s.actual_start || s.scheduled_start;
        return !!started && now - new Date(started).getTime() < WINDOW_MS;
      });
      setEvent(next || null);
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [hidden]);

  if (hidden || !event || dismissed.includes(event.id)) return null;

  const platformKey = (event.assigned_pages || []).find((p) => PLATFORMS[p]);
  const platform = platformKey ? PLATFORMS[platformKey] : null;
  const to = platform ? platform.path : `/live/${event.id}`;
  if (pathname === to) return null;

  const close = () => {
    const next = [...dismissed, event.id].slice(-30);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="fixed top-2 left-1/2 z-[60] w-[calc(100%-1rem)] max-w-xl -translate-x-1/2" role="status">
      <div className="flex items-center gap-3 rounded-xl border border-orange-500/40 bg-[#1a1a2e]/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold tracking-wide text-orange-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          LIVE NOW
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-white">
          {(event.title || "A game").trim()}
          {platform ? ` · ${platform.name}` : ""}
        </span>
        <Link
          to={to}
          className="shrink-0 rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600"
        >
          Watch
        </Link>
        <button onClick={close} aria-label="Dismiss" className="shrink-0 text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
