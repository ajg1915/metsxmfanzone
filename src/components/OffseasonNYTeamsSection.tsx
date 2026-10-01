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


interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string | null;
  assigned_pages: string[];
  // Unpublished games are shown as "coming soon" until a link is added and published.
  published: boolean;
}

const OffseasonNYTeamsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin, canWatchNYSports } = useSubscription();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

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
      // Upcoming NY team games, published or not (schedule details only, no stream links).
      const { data, error } = await (supabase as any).rpc("get_ny_sports_schedule", { p_limit: 24 });

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
    if (isAdmin || canWatchNYSports) {
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
            <img src={metsxmfanzoneLogo} alt="MetsXMFanZone" className="w-5 h-5 sm:w-6 sm:h-6 rounded object-contain" />
            <h2 className="text-[25px] leading-none tracking-wide sm:text-2xl md:text-3xl font-bold uppercase text-foreground">
              NY Sports Teams Events
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('left')}
              className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex"
              aria-label="Scroll offseason streams left"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('right')}
              className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex"
              aria-label="Scroll offseason streams right"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div 
          id="ny-teams-scroll"
          className="-mx-4 flex gap-3 overflow-x-auto scrollbar-hide snap-x max-md:snap-mandatory scroll-px-4 px-4 pb-4 md:mx-0 md:gap-4 md:px-0"
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {streams.map((stream) => {
            const isLive = stream.status === "live";
            const linkReady = stream.published;
            const canWatch = isLive && linkReady;
            return (
            <article
              key={stream.id}
              onClick={() => canWatch && handleStreamClick(stream)}
              className={`${canWatch ? "cursor-pointer" : "cursor-default"} flex-shrink-0 w-[calc(100vw-4.5rem)] max-w-[340px] md:w-[320px] md:max-w-none lg:w-[380px] group relative snap-start`}
            >
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50 group-hover:border-primary/50 transition-all duration-300">
                <img 
                  src={stream.thumbnail_url || fanartGeneral} 
                  alt={stream.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = fanartGeneral; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2">
                  <Badge variant={canWatch ? "destructive" : "secondary"} className={canWatch ? "animate-pulse" : ""}>
                    {isLive ? <Radio className="w-3 h-3 mr-1" /> : <CalendarClock className="w-3 h-3 mr-1" />}
                    {isLive ? "LIVE" : "UPCOMING"}
                  </Badge>
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/80 backdrop-blur-sm">
                  <ShieldCheck className="w-2.5 h-2.5 text-accent-foreground" />
                  <span className="text-[9px] font-semibold text-accent-foreground uppercase tracking-wide">VPN Secured</span>
                </div>

                {canWatch && (
                  <Button
                    type="button"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleStreamClick(stream); }}
                    className="absolute inset-0 m-auto h-14 w-14 rounded-full opacity-95 md:h-12 md:w-12 transition-all group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label={`Watch ${stream.title}`}
                  >
                    <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                  </Button>
                )}
              </div>
              <div className="mt-2">
                <h3 className="text-[15px] font-semibold line-clamp-1 md:text-sm text-foreground group-hover:text-primary transition-colors">
                  {stream.title}
                </h3>
                <p className="text-[13px] text-muted-foreground line-clamp-1 md:text-xs">
                  {stream.description || 'Live NY sports coverage'}
                </p>
                {!isLive && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatScheduledStart(stream.scheduled_start)}
                  </p>
                )}
                {!linkReady && (
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stream link coming soon
                  </p>
                )}
              </div>
            </article>
            );
          })}
        </div>
      </div>

    </section>
  );
};

export default OffseasonNYTeamsSection;
