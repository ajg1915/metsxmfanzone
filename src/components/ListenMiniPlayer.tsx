import { Link } from "react-router-dom";
import { Headphones, Pause, Play, X, Loader2 } from "lucide-react";
import { stopListening, togglePlay, useListenSession } from "@/lib/listenSession";

/** Small player that stays on screen while a viewer keeps listening and browses other pages. */
export default function ListenMiniPlayer() {
  const s = useListenSession();
  if (!s.active || s.panelHosts > 0) return null;

  return (
    <div
      className="fixed left-2 right-2 z-[49] md:left-auto md:right-4 md:w-[380px]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-primary/50 bg-[#0d2342]/95 px-2.5 py-2 text-white shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={() => togglePlay()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95"
          aria-label={s.playing ? "Pause" : "Play"}
        >
          {s.status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : s.playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" fill="currentColor" />}
        </button>
        <Link to={s.path || "/"} className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
            <Headphones className="h-3 w-3" /> {s.status === "error" ? "Stream offline, retrying" : "Listening live"}
          </p>
          <p className="truncate text-sm font-bold leading-tight">{s.title}</p>
        </Link>
        <button type="button" onClick={stopListening} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/70 active:scale-95" aria-label="Stop listening">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
