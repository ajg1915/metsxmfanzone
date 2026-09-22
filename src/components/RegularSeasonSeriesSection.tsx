import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, ChevronLeft, Radio, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import fanartGeneral from "@/assets/fanart-mets-general.jpg";
import { useFreeTrialConfig } from "@/hooks/useFreeTrial";
import PremiumBadge from "@/components/PremiumBadge";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { AdminEditBadge } from "@/components/admin/AdminEditBadge";

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  stream_url: string;
  thumbnail_url: string | null;
  status: string;
  scheduled_start: string | null;
  viewers_count: number | null;
  assigned_pages: string[] | null;
}

interface SeriesGroup {
  opponent: string;
  streams: LiveStream[];
  hasLive: boolean;
  earliestDate: string | null;
}

const extractOpponent = (title: string): string | null => {
  const normalizedTitle = title
    .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const matchup = normalizedTitle.match(/(?:mets|nym)\s*(?:vs\.?|@|at)\s+(.+)$/i);
  return matchup ? matchup[1].trim() : null;
};

const RegularSeasonSeriesSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin } = useSubscription();
  const { config: trialConfig } = useFreeTrialConfig();
  const guestPreviewOn = !user && trialConfig.guestPreviewEnabled !== false;
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchGames = async () => {
    try {
      // Signed-out visitors read the public view (no playback URLs) so artwork stays visible.
      const { data, error } = await (supabase as any)
        .from(user ? "live_streams" : "live_streams_public")
        .select("*")
        .eq("published", true)
        .order("scheduled_start", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const games = ((data || []) as LiveStream[]).filter((game) => {
        const isRegularSeasonAssigned = game.assigned_pages?.includes("regular-season-games");
        const hasMatchupTitle = extractOpponent(game.title) !== null;
        return isRegularSeasonAssigned || hasMatchupTitle;
      });

      const groupMap = new Map<string, LiveStream[]>();

      for (const game of games) {
        const opponent = extractOpponent(game.title);
        if (!opponent) continue;

        if (!groupMap.has(opponent)) {
          groupMap.set(opponent, []);
        }

        groupMap.get(opponent)!.push(game);
      }

      const nowMs = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;

      const groups: (SeriesGroup & { isActive: boolean })[] = Array.from(groupMap.entries()).map(([opponent, streams]) => {
        const sorted = [...streams].sort((a, b) => {
          const aD = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
          const bD = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
          return aD - bD;
        });

        const dates = sorted.map((s) => (s.scheduled_start ? new Date(s.scheduled_start).getTime() : null)).filter((t): t is number => t !== null);
        const firstMs = dates[0] ?? null;
        const lastMs = dates[dates.length - 1] ?? null;
        const hasLive = sorted.some((stream) => stream.status === "live");
        // Active = a series whose date range includes "now" (or within a 24h buffer of the last game)
        const isActive = hasLive || (firstMs !== null && lastMs !== null && nowMs >= firstMs - ONE_DAY && nowMs <= lastMs + ONE_DAY);

        return {
          opponent,
          streams: sorted,
          hasLive,
          earliestDate: sorted[0]?.scheduled_start || null,
          isActive,
        };
      });

      groups.sort((a, b) => {
        // Live first, then active, then upcoming, then past
        if (a.hasLive !== b.hasLive) return a.hasLive ? -1 : 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;

        const aT = a.earliestDate ? new Date(a.earliestDate).getTime() : Infinity;
        const bT = b.earliestDate ? new Date(b.earliestDate).getTime() : Infinity;
        const aIsPast = aT < nowMs - ONE_DAY;
        const bIsPast = bT < nowMs - ONE_DAY;
        if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
        return aT - bT;
      });

      setSeriesGroups(groups);
    } catch (err) {
      console.error("Error fetching regular season games:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeriesClick = (group: SeriesGroup) => {
    const previewStream = group.streams.find((stream) => stream.status === "live");

    if (!user && guestPreviewOn && previewStream) {
      navigate(`/live/${previewStream.id}`);
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    if (isAdmin || tier === "weekly" || tier === "premium" || tier === "annual") {
      navigate("/metsxmfanzone");
    } else {
      navigate("/plans");
    }
  };

  const formatDateRange = (streams: LiveStream[]) => {
    const dates = streams
      .map((stream) => stream.scheduled_start)
      .filter(Boolean) as string[];

    if (dates.length === 0) return "TBD";

    const first = new Date(dates[0]);
    const last = dates.length > 1 ? new Date(dates[dates.length - 1]) : null;
    const format = (date: Date) =>
      date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return last ? `${format(first)} – ${format(last)}` : format(first);
  };

  const scroll = (direction: "left" | "right") => {
    const container = document.getElementById("series-scroll");
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const newPosition =
      direction === "left"
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: "smooth" });
    setScrollPosition(newPosition);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center text-muted-foreground text-sm">Loading regular season series...</div>
        </div>
      </section>
    );
  }

  if (seriesGroups.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 relative">
      <AdminEditBadge to="/admin/live-streams" label="Edit Series" />
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            <h2 className="text-sm sm:text-xl md:text-2xl font-bold text-foreground">
              Regular Season Series
            </h2>
          </div>
          <a
            href="/mets-schedule-2026"
            className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Full Schedule
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="relative group/carousel">
        {scrollPosition > 0 && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
          >
            <ChevronLeft className="w-8 h-8 text-foreground" />
          </button>
        )}

        <div
          id="series-scroll"
          onScroll={handleScroll}
          className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-6 lg:px-8"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />

          {seriesGroups.map((group) => (
            <div
              key={group.opponent}
              onClick={() => handleSeriesClick(group)}
              className="flex-shrink-0 w-[240px] sm:w-[280px] md:w-[320px] lg:w-[380px] cursor-pointer group/card relative"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-md sm:rounded-lg transition-all duration-300 group-hover/card:scale-105 group-hover/card:z-10 group-hover/card:shadow-2xl group-hover/card:shadow-primary/20",
                  group.hasLive && "ring-1 ring-red-500/50"
                )}
              >
                <div className="aspect-video relative">
                  {group.streams[0]?.thumbnail_url ? (
                    <img
                      src={group.streams[0].thumbnail_url}
                      alt={`Mets vs ${group.opponent}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { if (e.currentTarget.src !== fanartGeneral) e.currentTarget.src = fanartGeneral; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Radio className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent opacity-70 group-hover/card:opacity-85 transition-opacity" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-300">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-75 group-hover/card:scale-100 transition-transform">
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {guestPreviewOn && group.hasLive ? (
                      <Badge className="text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-green-600/90 text-white">
                        FREE PREVIEW
                      </Badge>
                    ) : (
                      !isAdmin && tier !== "weekly" && tier !== "premium" && tier !== "annual" && (
                        <PremiumBadge size="sm" />
                      )
                    )}
                    {group.hasLive ? (
                      <Badge className="text-[10px] sm:text-xs px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-red-600/90 text-white shadow-lg shadow-red-600/50">
                        <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" />
                        LIVE
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] sm:text-xs px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-secondary/80 text-secondary-foreground">
                        UPCOMING
                      </Badge>
                    )}
                  </div>

                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 backdrop-blur-sm bg-background/80 text-foreground">
                      {group.streams.length} Game{group.streams.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-background to-transparent">
                  <p className="text-foreground text-xs sm:text-sm font-bold line-clamp-1">
                    Mets vs {group.opponent}
                  </p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs mt-0.5">
                    {formatDateRange(group.streams)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
        >
          <ChevronRight className="w-8 h-8 text-foreground" />
        </button>
      </div>
    </section>
  );
};

export default RegularSeasonSeriesSection;
