import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Play, ChevronRight, ChevronLeft, ShieldCheck, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import fanartGeneral from "@/assets/fanart-mets-general.jpg";

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string;
  assigned_pages: string[];
}

const OffseasonNYTeamsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin } = useSubscription();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  const nyTeamPages = ['ny-jets', 'ny-giants', 'ny-knicks', 'ny-rangers', 'ny-islanders', 'brooklyn-nets'];
  const isOffseasonTeamStream = (stream: LiveStream) => {
    if (stream.assigned_pages?.some((page) => nyTeamPages.includes(page))) return true;
    return /\b(new york|ny)\s+(jets|giants|knicks|rangers|islanders)\b|\bbrooklyn nets\b/i.test(`${stream.title} ${stream.description || ""}`);
  };

  useEffect(() => {
    fetchStreams();
    
    const channel = supabase.channel('ny-teams-streams-changes').on('postgres_changes', {
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
        .eq("status", "live")
        .order("scheduled_start", { ascending: true });

      if (error) throw error;

      const filtered = (data || []).filter((stream: LiveStream) => isOffseasonTeamStream(stream));

      setStreams(filtered as LiveStream[]);
    } catch (error) {
      console.error("Error fetching NY teams streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamClick = (stream: LiveStream) => {
    if (isAdmin || tier === "weekly" || tier === "premium" || tier === "annual") {
      navigate(`/live/${stream.id}`);
    } else {
      if (!user) navigate("/auth");
      else navigate("/pricing");
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('ny-teams-scroll');
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);
      
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  if (loading || streams.length === 0) return null;

  return (
    <section className="py-6 relative bg-background/50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Offseason NY Teams
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('left')}
              className="h-8 w-8 rounded-full bg-secondary/50"
              aria-label="Scroll offseason streams left"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('right')}
              className="h-8 w-8 rounded-full bg-secondary/50"
              aria-label="Scroll offseason streams right"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div 
          id="ny-teams-scroll"
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x pb-4"
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {streams.map((stream) => (
            <div
              key={stream.id}
              onClick={() => handleStreamClick(stream)}
              className="flex-shrink-0 w-[280px] md:w-[320px] lg:w-[380px] cursor-pointer group relative snap-start"
            >
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border/50 group-hover:border-primary/50 transition-all duration-300">
                <img 
                  src={stream.thumbnail_url || fanartGeneral} 
                  alt={stream.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = fanartGeneral; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2">
                  <Badge className="bg-red-600 text-white animate-pulse">
                    <Radio className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600/80 backdrop-blur-sm">
                  <ShieldCheck className="w-2.5 h-2.5 text-white" />
                  <span className="text-[8px] font-semibold text-white uppercase tracking-wide">VPN Secured</span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-semibold line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                  {stream.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {stream.description || 'Live NY sports coverage'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OffseasonNYTeamsSection;
