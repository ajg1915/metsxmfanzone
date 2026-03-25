import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, Radio, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import PremiumBadge from "@/components/PremiumBadge";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";

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
}

const extractOpponent = (title: string): string => {
  // Try to extract opponent from title like "Mets vs Yankees" or "NYM @ ATL"
  const vsMatch = title.match(/(?:mets|nym)\s*(?:vs\.?|@|at)\s*(.+)/i);
  if (vsMatch) return vsMatch[1].trim().split(/\s*[-–—|]/)[0].trim();
  // Fallback: use entire title
  return title;
};

const RegularSeasonSeriesSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin } = useSubscription();
  const [seriesGroups, setSeriesGroups] = useState<SeriesGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("published", true)
        .order("scheduled_start", { ascending: true });

      if (error) throw error;

      const games = (data || []) as LiveStream[];

      // Group by opponent
      const groupMap = new Map<string, LiveStream[]>();
      for (const game of games) {
        const opponent = extractOpponent(game.title);
        if (!groupMap.has(opponent)) groupMap.set(opponent, []);
        groupMap.get(opponent)!.push(game);
      }

      const groups: SeriesGroup[] = Array.from(groupMap.entries()).map(([opponent, streams]) => ({
        opponent,
        streams: streams.sort((a, b) => {
          const aDate = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
          const bDate = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
          return aDate - bDate;
        }),
        hasLive: streams.some(s => s.status === 'live'),
      }));

      // Sort groups: those with live games first, then by earliest game date
      groups.sort((a, b) => {
        if (a.hasLive && !b.hasLive) return -1;
        if (!a.hasLive && b.hasLive) return 1;
        const aFirst = a.streams[0]?.scheduled_start ? new Date(a.streams[0].scheduled_start).getTime() : Infinity;
        const bFirst = b.streams[0]?.scheduled_start ? new Date(b.streams[0].scheduled_start).getTime() : Infinity;
        return aFirst - bFirst;
      });

      setSeriesGroups(groups);
    } catch (err) {
      console.error("Error fetching regular season games:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGameClick = (stream: LiveStream) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isAdmin || tier === "premium" || tier === "annual") {
      navigate(`/metsxmfanzone`);
    } else {
      navigate("/plans");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center text-muted-foreground text-sm">Loading regular season games...</div>
        </div>
      </section>
    );
  }

  if (seriesGroups.length === 0) return null;

  return (
    <section className="py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {seriesGroups.map((group) => (
            <div
              key={group.opponent}
              className={cn(
                "rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5",
                group.hasLive && "ring-1 ring-red-500/40"
              )}
            >
              {/* Series header */}
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    Mets vs {group.opponent}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {group.streams.length} Game{group.streams.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                {group.hasLive && (
                  <Badge className="bg-red-600/90 text-white text-[10px] px-1.5 py-0.5 animate-pulse">
                    <Radio className="w-2.5 h-2.5 mr-1" />
                    LIVE
                  </Badge>
                )}
              </div>

              {/* Games in the series */}
              <div className="divide-y divide-border/50">
                {group.streams.map((stream) => (
                  <div
                    key={stream.id}
                    onClick={() => handleGameClick(stream)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title}
                        className="w-12 h-8 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Radio className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{stream.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(stream.scheduled_start)}
                        {stream.scheduled_start && ` • ${formatTime(stream.scheduled_start)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {stream.status === 'live' ? (
                        <Badge className="bg-red-600 text-white text-[9px] px-1.5 py-0">
                          LIVE
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          {stream.status === 'scheduled' ? 'UPCOMING' : 'ENDED'}
                        </Badge>
                      )}
                      {!isAdmin && tier !== "premium" && tier !== "annual" && (
                        <PremiumBadge size="sm" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RegularSeasonSeriesSection;
