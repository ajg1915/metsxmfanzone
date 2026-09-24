import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Play, ChevronRight, ChevronLeft, ShieldCheck, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import fanartGeneral from "@/assets/fanart-mets-general.jpg";
import metsxmfanzoneLogo from "@/assets/metsxmfanzone-logo.png";
import { isNYTeamStream } from "@/lib/nyTeamStreamCheck";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ClapprPlayer from "@/components/ClapprPlayer";

const SPORTS_EVENT_SECONDARY_URL = "https://mystream.metsxmfanzone.com/hls/mystream.m3u8";

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string | null;
  assigned_pages: string[];
}

const OffseasonNYTeamsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin } = useSubscription();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);

  const formatScheduledStart = (value: string | null) => {
    if (!value) return "Time to be announced";

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
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
        .in("status", ["live", "scheduled"])
        .order("scheduled_start", { ascending: true });

      if (error) throw error;

      const filtered = (data || [])
        .filter((stream: LiveStream) => isNYTeamStream(stream))
        .sort((a: LiveStream, b: LiveStream) => {
          if (a.status !== b.status) return a.status === "live" ? -1 : 1;
          const aStart = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER;
          const bStart = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER;
          return aStart - bStart;
        });

      setStreams(filtered as LiveStream[]);
    } catch (error) {
      console.error("Error fetching NY teams streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamClick = (stream: LiveStream) => {
    if (isAdmin || tier === "weekly" || tier === "premium" || tier === "annual") {
      setActiveStream(stream);
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
            <img src={metsxmfanzoneLogo} alt="MetsXMFanZone" className="w-5 h-5 sm:w-6 sm:h-6 rounded object-contain" />
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              NY Sports Teams Events
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
          {streams.map((stream) => {
            const isLive = stream.status === "live";
            return (
            <article
              key={stream.id}
              onClick={() => isLive && handleStreamClick(stream)}
              className="cursor-pointer flex-shrink-0 w-[280px] md:w-[320px] lg:w-[380px] group relative snap-start"
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
                  <Badge variant={isLive ? "destructive" : "secondary"} className={isLive ? "animate-pulse" : ""}>
                    {isLive ? <Radio className="w-3 h-3 mr-1" /> : <CalendarClock className="w-3 h-3 mr-1" />}
                    {isLive ? "LIVE" : "UPCOMING"}
                  </Badge>
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/80 backdrop-blur-sm">
                  <ShieldCheck className="w-2.5 h-2.5 text-accent-foreground" />
                  <span className="text-[8px] font-semibold text-accent-foreground uppercase tracking-wide">VPN Secured</span>
                </div>

                {isLive && (
                  <Button
                    type="button"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleStreamClick(stream); }}
                    className="absolute inset-0 m-auto h-12 w-12 rounded-full opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Watch ${stream.title}`}
                  >
                    <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                  </Button>
                )}
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-semibold line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                  {stream.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {stream.description || 'Live NY sports coverage'}
                </p>
                {!isLive && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatScheduledStart(stream.scheduled_start)}
                  </p>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </div>

      <Dialog open={!!activeStream} onOpenChange={(o) => !o && setActiveStream(null)}>
        <DialogContent className="max-w-4xl w-[96vw] p-2 sm:p-4 bg-card/95 backdrop-blur-xl">
          <DialogHeader className="px-1">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Radio className="w-4 h-4 text-destructive animate-pulse" />
              {activeStream?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {activeStream?.description || "Live NY sports coverage"}
            </DialogDescription>
          </DialogHeader>
          {activeStream && (
            <div className="rounded-lg overflow-hidden bg-player">
              <ClapprPlayer
                source={SPORTS_EVENT_SECONDARY_URL}
                showChrome
                pageTitle={activeStream.title}
                streamId={activeStream.id}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default OffseasonNYTeamsSection;
