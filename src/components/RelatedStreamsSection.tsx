import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import channelMlb from "@/assets/channel-mlb.jpg";
import channelSny from "@/assets/channel-sny.jpg";
import channelMsg from "@/assets/channel-msg.jpg";
import channelEspn from "@/assets/channel-espn.jpg";
import channelPix11 from "@/assets/channel-pix11.jpg";
import channelXm2 from "@/assets/channel-xm2.jpg";

interface RelatedStream {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string | null;
  fallbackThumb?: string | null;
  href: string;
  external?: boolean;
  assignedPages?: string[];
  /** Premium platform cards stay visible even when nothing is live */
  alwaysShow?: boolean;
  badge?: string;
}

interface LiveStreamRecord {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  assigned_pages: string[] | null;
  status?: string | null;
  scheduled_start?: string | null;
  offline_loop?: boolean | null;
}

const whenET = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) + " ET";

const FALLBACK_STREAMS: RelatedStream[] = [
  {
    id: "mlb-network",
    title: "Apple TV",
    subtitle: "Premium — Mets game events",
    thumbnail: channelMlb,
    href: "/apple-tv",
    alwaysShow: true,
    badge: "Premium",
  },
  {
    id: "sny-tv",
    title: "SNY.TV 24/7",
    subtitle: "24/7 — SportsNet New York, the official home of the Mets",
    thumbnail: channelSny,
    href: "/live/sny-tv",
  },
  {
    id: "msg-network",
    title: "Peacock",
    subtitle: "Premium — Mets game events",
    thumbnail: channelMsg,
    href: "/peacock",
    alwaysShow: true,
    badge: "Premium",
  },
  {
    id: "espn-network",
    title: "Prime Video",
    subtitle: "Premium — Mets game events",
    thumbnail: channelEspn,
    href: "/prime-video",
    alwaysShow: true,
    badge: "Premium",
  },
  {
    id: "pix11-network",
    title: "MetsXMFanZone Game Events",
    subtitle: "Non-Mets games & live event streams",
    thumbnail: channelPix11,
    href: "/pix11-network",
  },
  {
    id: "metsxmfanzone-2",
    title: "MetsXMFanZone Stream 2",
    subtitle: "24/7 — MetsXMFanZone second channel, fan shows & extra coverage",
    thumbnail: channelXm2,
    href: "/live/metsxmfanzone-2",
  },
];


// Actual game broadcasts should never fill a 24/7 network card
const isGameBroadcast = (title: string) =>
  /\b(mets|nym)\b\s*(vs\.?|@|at)\s+/i.test(title) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(title);

const OFFSEASON_TEAM_PAGES = new Set(['ny-jets', 'ny-giants', 'ny-knicks', 'ny-rangers', 'ny-islanders', 'brooklyn-nets']);
const isOffseasonTeamStream = (stream: Pick<LiveStreamRecord, "title" | "description" | "assigned_pages">) =>
  (stream.assigned_pages?.some((page) => OFFSEASON_TEAM_PAGES.has(page)) ?? false)
  || /\b(new york|ny)\s+(jets|giants|knicks|rangers|islanders)\b|\bbrooklyn nets\b/i.test(`${stream.title} ${stream.description || ""}`);

const isMlbNetwork24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return (title.includes("mlb network") || title.includes("apple tv")) || stream.assigned_pages?.includes("mlb-network");
};

const isSnyTv24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("sny.tv") && title.includes("24/7") || stream.assigned_pages?.includes("sny-tv");
};

const isMsgNetwork24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return (title.includes("msg network") || title.includes("peacock")) || stream.assigned_pages?.includes("msg-network");
};

const isEspn24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return (title.includes("espn") || title.includes("prime video")) || stream.assigned_pages?.includes("espn-network");
};

const isPix1124x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("pix11") || title.includes("pix 11") || title.includes("game events") || !!stream.assigned_pages?.includes("pix11-network");
};

const isMetsXM2 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("metsxmfanzone") && (title.includes("2") || title.includes("stream 2"))
    || !!stream.assigned_pages?.includes("metsxmfanzone-2");
};


const streamToCard = (stream: LiveStreamRecord, fallback: RelatedStream): RelatedStream => {
  const pages = stream.assigned_pages || [];
  let href = `/live/${stream.id}`;
  if (pages.includes("mlb-network")) href = "/apple-tv";
  else if (pages.includes("espn-network")) href = "/prime-video";
  else if (pages.includes("pix11-network")) href = "/pix11-network";
  else if (pages.includes("msg-network")) href = "/peacock";
  else if (pages.includes("metsxmfanzone-2")) href = "/live/metsxmfanzone-2";
  return {
    id: stream.id,
    title: stream.title,
    subtitle:
      stream.status === "live" && stream.offline_loop
        ? "Offline: loop playing"
        : stream.status === "scheduled"
        ? stream.scheduled_start ? `Upcoming — ${whenET(stream.scheduled_start)}` : "Upcoming — going live soon"
        : stream.description || fallback.subtitle,
    // Always prefer the artwork set in admin; bundled art is only a safety net
    thumbnail: stream.thumbnail_url || fallback.thumbnail,
    fallbackThumb: fallback.thumbnail,
    alwaysShow: fallback.alwaysShow,
    badge:
      stream.status === "scheduled"
        ? "Upcoming"
        : stream.status === "live" && stream.offline_loop
          ? "Offline"
          : fallback.alwaysShow && stream.status === "live"
            ? "Live"
            : fallback.badge,
    href,
    assignedPages: pages,
  };
};




const RelatedStreamsSection = () => {
  const navigate = useNavigate();
  const [networkStreams, setNetworkStreams] = useState<LiveStreamRecord[]>([]);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchNetworkStreams = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await (supabase as any)
        .from(sessionData.session ? "live_streams" : "live_streams_public")
        .select("id, title, description, thumbnail_url, assigned_pages, status, scheduled_start, offline_loop")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .limit(25);

      if (error) {
        console.error("Error fetching sports network streams:", error);
        return;
      }

      if (!cancelled) {
        setNetworkStreams((data || []) as LiveStreamRecord[]);
      }
    };

    fetchNetworkStreams();

    const channel = supabase
      .channel("sports-network-streams")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, fetchNetworkStreams)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const streams = useMemo(() => {
    const matchers = [
      isMlbNetwork24x7,
      isSnyTv24x7,
      isMsgNetwork24x7,
      isEspn24x7,
      isPix1124x7,
      isMetsXM2,
    ];

    // Show channels that are live in the database. Apple TV, Prime Video and Peacock
    // always show, even when no game is live, using their built-in card.
    return matchers
      .map((matcher, i) => {
        const matches = networkStreams.filter((candidate) => !isOffseasonTeamStream(candidate) && matcher(candidate));
        // Live streams win over upcoming ones
        const stream = matches.find((c) => c.status === "live") || matches[0];
        if (stream) return streamToCard(stream, FALLBACK_STREAMS[i]);
        return FALLBACK_STREAMS[i].alwaysShow ? FALLBACK_STREAMS[i] : null;
      })
      .filter((s): s is RelatedStream => s !== null);
  }, [networkStreams]);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('network-streams-scroll');
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const handleClick = (s: RelatedStream) => {
    if (s.external) {
      window.open(s.href, "_blank", "noopener,noreferrer");
    } else {
      navigate(s.href);
    }
  };

  if (streams.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 relative">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <div>
              <h2 className="text-[25px] leading-none tracking-wide sm:text-2xl md:text-3xl font-bold uppercase text-foreground">
                Premium Services
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">All Game events are on these live Streams</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('left')}
              className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex"
              aria-label="Scroll network streams left"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => scroll('right')}
              className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex"
              aria-label="Scroll network streams right"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div
          id="network-streams-scroll"
          className="-mx-3 flex gap-3 overflow-x-auto scrollbar-hide snap-x max-md:snap-mandatory scroll-px-4 px-4 pb-4 sm:-mx-6 sm:px-6 md:mx-0 md:gap-4 md:px-0"
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
        >
          {streams.map((s) => (
            <button
              key={s.id}
              onClick={() => handleClick(s)}
              className="flex-shrink-0 w-[calc(100vw-4.5rem)] max-w-[340px] md:w-[320px] md:max-w-none lg:w-[380px] group relative snap-start text-left"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50 group-hover:border-primary/50 transition-all duration-300">
                {s.thumbnail ? (
                  <img
                    src={s.thumbnail}
                    alt={s.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (s.fallbackThumb && img.src !== s.fallbackThumb) {
                        img.src = s.fallbackThumb;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Radio className="w-12 h-12 text-primary/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />

                <div className="absolute top-2 right-2">
                  <Badge className="text-[10px] px-1.5 py-0.5 font-semibold bg-primary/90 text-primary-foreground backdrop-blur-sm">
                    {s.badge || "24/7"}
                  </Badge>
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/80 backdrop-blur-sm">
                  <ShieldCheck className="w-2.5 h-2.5 text-accent-foreground" />
                  <span className="text-[9px] font-semibold text-accent-foreground uppercase tracking-wide">VPN Secured</span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-[15px] font-semibold line-clamp-1 md:text-sm text-foreground group-hover:text-primary transition-colors">
                  {s.title}
                </h3>
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-[13px] text-muted-foreground line-clamp-1 flex-1 md:text-xs">
                    {s.subtitle}
                  </p>
                  <ChevronRight
                    className="w-3.5 h-3.5 text-primary flex-shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RelatedStreamsSection;
