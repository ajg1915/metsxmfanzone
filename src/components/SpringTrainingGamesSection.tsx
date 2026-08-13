import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, Play, ChevronRight, ChevronLeft, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const getMatchupRoute = (title: string): string | null => {
  const t = title.toLowerCase();
  if (t.includes("astros") || t.includes("houston")) return "/matchup/astros";
  if (t.includes("braves") || t.includes("atlanta")) return "/matchup/braves";
  if (t.includes("cardinals") || t.includes("st. louis") || t.includes("stl")) return "/matchup/cardinals";
  if (t.includes("nationals") || t.includes("washington")) return "/matchup/nationals";
  if (t.includes("red sox") || t.includes("boston")) return "/matchup/redsox";
  if (t.includes("yankees")) return "/matchup/yankees";
  if (t.includes("blue jays") || t.includes("toronto")) return "/matchup/bluejays";
  return null;
};

interface LiveStream {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string;
  viewers_count: number;
  assigned_pages: string[];
}

const SpringTrainingGamesSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchStreams();

    const channel = supabase.channel('spring-training-streams-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_streams'
    }, () => {
      fetchStreams();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStreams = async () => {
    try {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .contains("assigned_pages", ["spring-training-games"])
        .order("scheduled_start", { ascending: true })
        .limit(8);
      
      if (error) throw error;
      setStreams((data || []) as LiveStream[]);
    } catch (error) {
      console.error("Error fetching spring training streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceGrade = (stream: LiveStream): { grade: string; color: string; percent: number } => {
    const isLive = stream.status === 'live';
    const hasViewers = stream.viewers_count > 0;
    const hasThumb = !!stream.thumbnail_url;
    let score = 50;
    if (isLive) score += 30;
    if (hasViewers) score += Math.min(stream.viewers_count * 2, 15);
    if (hasThumb) score += 5;
    score = Math.min(score, 99);
    if (score >= 90) return { grade: 'A+', color: 'text-emerald-400', percent: score };
    if (score >= 80) return { grade: 'A', color: 'text-emerald-400', percent: score };
    if (score >= 70) return { grade: 'B+', color: 'text-green-400', percent: score };
    if (score >= 60) return { grade: 'B', color: 'text-yellow-400', percent: score };
    return { grade: 'C', color: 'text-orange-400', percent: score };
  };

  const handleStreamClick = (stream: LiveStream) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate("/metsxmfanzone");
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('spring-training-scroll');
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading regular season games...</div>
        </div>
      </section>
    );
  }

  if (streams.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 relative">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-sm sm:text-xl md:text-2xl">⚾</span>
            <h2 className="text-xs sm:text-xl md:text-2xl font-bold text-foreground">
              Regular Season Live Games
            </h2>
            <Badge className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 font-semibold bg-green-600/90 text-white">
              FREE
            </Badge>
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (!user) {
                navigate("/auth");
                return;
              }
              navigate("/metsxmfanzone");
            }}
            className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      <div className="relative group/carousel">
        {scrollPosition > 0 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
          >
            <ChevronLeft className="w-8 h-8 text-foreground" />
          </button>
        )}

        <div
          id="spring-training-scroll"
          onScroll={handleScroll}
          className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-6 lg:px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />

          {streams.map((stream, index) => (
            <motion.div
              key={stream.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => handleStreamClick(stream)}
              className="flex-shrink-0 w-[240px] sm:w-[280px] md:w-[320px] lg:w-[380px] cursor-pointer group"
            >
              <div className="relative overflow-hidden rounded-md sm:rounded-lg transition-all duration-300 group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-primary/20">
                <div className="aspect-video relative">
                  {stream.thumbnail_url ? (
                    <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Radio className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <Badge className={cn(
                      "text-[10px] sm:text-xs px-1.5 py-0.5 font-semibold backdrop-blur-sm",
                      stream.status === 'live'
                        ? 'bg-red-600/90 text-white shadow-lg shadow-red-600/50'
                        : 'bg-secondary/80 text-secondary-foreground'
                    )}>
                      {stream.status === 'live' && <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" />}
                      {stream.status === 'live' ? 'LIVE' : 'UPCOMING'}
                    </Badge>
                  </div>

                  {stream.viewers_count > 0 && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/90 backdrop-blur-sm text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                      <Users className="w-3 h-3 text-primary" />
                      {stream.viewers_count}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-background to-transparent">
                  <p className="text-foreground text-xs sm:text-sm font-semibold line-clamp-2">
                    {stream.title}
                  </p>
                  {getMatchupRoute(stream.title) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(getMatchupRoute(stream.title)!);
                      }}
                      className="flex items-center gap-1 mt-1 text-[9px] sm:text-[10px] text-primary hover:text-primary/80 font-bold transition-colors"
                    >
                      <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      View Matchup Breakdown
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
        >
          <ChevronRight className="w-8 h-8 text-foreground" />
        </button>
      </div>
    </section>
  );
};

export default SpringTrainingGamesSection;
