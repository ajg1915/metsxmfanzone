import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

interface LiveStreamRecord {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  assigned_pages: string[] | null;
}

const FALLBACK_STREAMS: RelatedStream[] = [
  {
    id: "mlb-network",
    title: "MLB Network 24/7",
    subtitle: "24/7 — League-wide highlights, analysis & live look-ins",
    thumbnail: channelMlb,
    href: "/mlb-network",
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
    title: "MSG Network 24/7",
    subtitle: "24/7 — Madison Square Garden Network, NY sports all day",
    thumbnail: channelMsg,
    href: "/live/msg-network",
  },
  {
    id: "espn-network",
    title: "ESPN 24/7",
    subtitle: "24/7 — ESPN live sports, highlights & analysis",
    thumbnail: channelEspn,
    href: "/espn-network",
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
  return title.includes("mlb network") && title.includes("24/7") || stream.assigned_pages?.includes("mlb-network");
};

const isSnyTv24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("sny.tv") && title.includes("24/7") || stream.assigned_pages?.includes("sny-tv");
};

const isMsgNetwork24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("msg network") && title.includes("24/7") || stream.assigned_pages?.includes("msg-network");
};

const isEspn24x7 = (stream: Pick<LiveStreamRecord, "title" | "assigned_pages">) => {
  if (isGameBroadcast(stream.title)) return false;
  const title = stream.title.toLowerCase();
  return title.includes("espn") && title.includes("24/7") || stream.assigned_pages?.includes("espn-network");
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
  if (pages.includes("mlb-network")) href = "/mlb-network";
  else if (pages.includes("espn-network")) href = "/espn-network";
  else if (pages.includes("pix11-network")) href = "/pix11-network";
  else if (pages.includes("msg-network")) href = "/live/msg-network";
  else if (pages.includes("metsxmfanzone-2")) href = "/live/metsxmfanzone-2";
  return {
    id: stream.id,
    title: stream.title,
    subtitle: stream.description || fallback.subtitle,
    // Always prefer the artwork set in admin; bundled art is only a safety net
    thumbnail: stream.thumbnail_url || fallback.thumbnail,
    fallbackThumb: fallback.thumbnail,
    href,
    assignedPages: pages,
  };
};




const RelatedStreamsSection = () => {
  const navigate = useNavigate();
  const [networkStreams, setNetworkStreams] = useState<LiveStreamRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchNetworkStreams = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await (supabase as any)
        .from(sessionData.session ? "live_streams" : "live_streams_public")
        .select("id, title, description, thumbnail_url, assigned_pages")
        .eq("published", true)
        .eq("status", "live")
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

    // Only show channels that actually exist as live streams in the database.
    return matchers
      .map((matcher, i) => {
        const stream = networkStreams.find((candidate) => !isOffseasonTeamStream(candidate) && matcher(candidate));
        return stream ? streamToCard(stream, FALLBACK_STREAMS[i]) : null;
      })
      .filter((s): s is RelatedStream => s !== null);
  }, [networkStreams]);

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
            <Radio className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            <h2 className="text-sm sm:text-xl md:text-2xl font-bold text-foreground">
              Sports Network Streams
            </h2>
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
            24/7 · MLB · SNY · MSG · ESPN · Game Events · XM2
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">


          {streams.map((s) => (
            <button
              key={s.id}
              onClick={() => handleClick(s)}
              className="group relative overflow-hidden rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20 text-left"
            >
              <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-primary/20 via-background to-background">
                {s.thumbnail ? (
                  <img
                    src={s.thumbnail}
                    alt={s.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (s.fallbackThumb && img.src !== s.fallbackThumb) {
                        img.src = s.fallbackThumb;
                      }
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Radio className="w-12 h-12 text-primary/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />


                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <Badge className="text-[10px] px-1.5 py-0.5 font-semibold bg-primary/90 text-primary-foreground backdrop-blur-sm">
                    24/7
                  </Badge>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600/80 backdrop-blur-sm">
                  <ShieldCheck className="w-2.5 h-2.5 text-white" />
                  <span className="text-[8px] font-semibold text-white uppercase tracking-wide">
                    VPN Secured
                  </span>
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                      {s.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {s.subtitle}
                    </p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 text-primary flex-shrink-0 transition-transform",
                      "group-hover:translate-x-1"
                    )}
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
