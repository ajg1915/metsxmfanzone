import { useState } from "react";
import { Play, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ClapprPlayer from "@/components/ClapprPlayer";

interface LiveStream {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  stream_url: string;
  status: string;
}

interface TVHeroPlayerProps {
  streams: LiveStream[];
}

export function TVHeroPlayer({ streams }: TVHeroPlayerProps) {
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);

  // Pick the first live stream, or first available
  const liveStream = streams.find((s) => s.status === "live") || streams[0];
  if (!liveStream) return null;

  const displayStream = activeStream || liveStream;
  const isPlaying = activeStream !== null;

  return (
    <div className="rounded-lg overflow-hidden border border-border/40 bg-card/60">
      <div className="relative aspect-video max-h-[180px] w-full overflow-hidden landscape:max-h-[80vh] landscape:fixed landscape:inset-0 landscape:z-50 landscape:aspect-auto sm:landscape:relative sm:landscape:inset-auto sm:landscape:z-auto sm:landscape:max-h-[180px] sm:landscape:aspect-video">
        {isPlaying ? (
          <ClapprPlayer source={displayStream.stream_url} showChrome={false} />
        ) : (
          <>
            <img
              src={displayStream.thumbnail_url || "/placeholder.svg"}
              alt={displayStream.title}
              className="w-full h-full object-cover"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
              <button
                onClick={() => setActiveStream(displayStream)}
                className="w-10 h-10 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
              </button>
            </div>
            {/* LIVE badge */}
            {displayStream.status === "live" && (
              <Badge className="absolute top-2 left-2 bg-red-600 text-white border-0 text-[9px] px-1.5 py-0 h-4 gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Info bar */}
      <div className="px-2.5 py-1.5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground truncate">
            {displayStream.title}
          </p>
          {displayStream.description && (
            <p className="text-[9px] text-muted-foreground truncate">
              {displayStream.description.slice(0, 80)}
            </p>
          )}
        </div>
        {streams.length > 1 && (
          <div className="flex gap-1 ml-2 shrink-0">
            {streams.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStream(s)}
                className={cn(
                  "w-5 h-5 rounded border text-[7px] font-bold flex items-center justify-center transition-all",
                  (activeStream?.id || liveStream.id) === s.id
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-primary/40"
                )}
                title={s.title}
              >
                {s.status === "live" ? (
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                ) : (
                  (streams.indexOf(s) + 1)
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
