import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, Play, ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import PremiumBadge from "@/components/PremiumBadge";

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

const ReplayGamesSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin } = useSubscription();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchStreams();

    const channel = supabase.channel('replay-streams-changes').on('postgres_changes', {
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
      const { data, error } = await (supabase as any)
        .from("live_streams_public")
        .select("*")
        .eq("published", true)
        .contains("assigned_pages", ["replay-games"])
        .order("scheduled_start", { ascending: false })
        .limit(8);
      
      if (error) throw error;
      setStreams((data || []) as LiveStream[]);
    } catch (error) {
      console.error("Error fetching replay streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSpringTrainingStream = (stream: LiveStream) => {
    return stream.assigned_pages?.includes('spring-training-live') && !stream.assigned_pages?.includes('metsxmfanzone');
  };

  const getStreamPageUrl = (stream: LiveStream) => {
    const networkPages = (stream.assigned_pages || []).filter(page => page !== 'live' && page !== 'guide');
    if (networkPages.includes('metsxmfanzone')) return '/metsxmfanzone';
    if (networkPages.includes('mlb-network')) return '/mlb-network';
    if (networkPages.includes('espn-network')) return '/espn-network';
    if (networkPages.includes('pix11-network')) return '/pix11-network';
    if (networkPages.includes('spring-training-live')) return '/spring-training-live';
    return `/live/${stream.id}`;
  };

  const handleStreamClick = (stream: LiveStream) => {
    if (isSpringTrainingStream(stream)) {
      navigate(getStreamPageUrl(stream));
      return;
    }
    if (isAdmin || tier === "weekly" || tier === "premium" || tier === "annual") {
      navigate(getStreamPageUrl(stream));
    } else {
      navigate("/pricing");
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('replay-scroll');
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
          <div className="text-center text-muted-foreground">Loading replay games...</div>
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
            <RotateCcw className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            <h2 className="text-sm sm:text-xl md:text-2xl font-bold text-foreground">
              Replay Games
            </h2>
          </div>
          <a
            href="/replay-games"
            className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View All Replays
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
          id="replay-scroll"
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
                      <RotateCcw className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {!isSpringTrainingStream(stream) && !isAdmin && tier !== "weekly" && tier !== "premium" && tier !== "annual" && (
                      <PremiumBadge size="sm" />
                    )}
                    {isSpringTrainingStream(stream) && !isAdmin && tier !== "weekly" && tier !== "premium" && tier !== "annual" && (
                      <Badge className="text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-green-600/90 text-white">
                        FREE
                      </Badge>
                    )}
                    <Badge className="text-[10px] sm:text-xs px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-muted/80 text-muted-foreground">
                      <RotateCcw className="w-2.5 h-2.5 mr-1" />
                      REPLAY
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

export default ReplayGamesSection;
