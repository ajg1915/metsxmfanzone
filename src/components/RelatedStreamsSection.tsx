import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Radio, Play, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import mlbFanart from "@/assets/mlb-network-fanart.jpg";
import snyFanart from "@/assets/sny-tv-fanart.jpg";

interface RelatedStream {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  href: string;
  external?: boolean;
}

const RELATED_STREAMS: RelatedStream[] = [
  {
    id: "mlb-network",
    title: "MLB Network",
    subtitle: "24/7 — League-wide highlights, analysis & live look-ins",
    thumbnail: mlbFanart,
    href: "/mlb-network",
  },
  {
    id: "sny-tv",
    title: "SNY.TV",
    subtitle: "24/7 — SportsNet New York, the official home of the Mets",
    thumbnail: snyFanart,
    href: "https://sny.tv/mets",
    external: true,
  },
];

const RelatedStreamsSection = () => {
  const navigate = useNavigate();

  const handleClick = (s: RelatedStream) => {
    if (s.external) {
      window.open(s.href, "_blank", "noopener,noreferrer");
    } else {
      navigate(s.href);
    }
  };

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
            24/7 · MLB Network · SNY.TV
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {RELATED_STREAMS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleClick(s)}
              className="group relative overflow-hidden rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20 text-left"
            >
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={s.thumbnail}
                  alt={s.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
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
