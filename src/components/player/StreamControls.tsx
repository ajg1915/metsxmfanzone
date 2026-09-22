import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  RotateCw,
  BarChart3,
  Settings,
  Maximize,
  Minimize,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StreamControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hlsRef: React.MutableRefObject<Hls | null>;
  containerRef: React.RefObject<HTMLElement>;
  onReload?: () => void;
  channelLabel?: string;
}

/**
 * Broadcast-style control bar shared by every live player on the site.
 * Big icon buttons, live progress rail, quality + stats panels.
 */
export function StreamControls({
  videoRef,
  hlsRef,
  containerRef,
  onReload,
  channelLabel,
}: StreamControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [stats, setStats] = useState({ resolution: "—", bitrate: "—", buffer: "0.0s" });
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<number>();

  // Auto-hide the bar during playback, reveal on any pointer activity.
  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setVisible(false);
    }, 3200);
  }, [videoRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const events = ["mousemove", "touchstart", "click"] as const;
    events.forEach((e) => el.addEventListener(e, poke));
    poke();
    return () => {
      events.forEach((e) => el.removeEventListener(e, poke));
      window.clearTimeout(hideTimer.current);
    };
  }, [containerRef, poke]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setPlaying(!v.paused);
      setMuted(v.muted || v.volume === 0);
      setVolume(v.muted ? 0 : v.volume);
    };
    const evts = ["play", "pause", "volumechange"] as const;
    evts.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => evts.forEach((e) => v.removeEventListener(e, sync));
  }, [videoRef]);

  useEffect(() => {
    const onFs = () => {
      const active = !!document.fullscreenElement || containerRef.current?.classList.contains("ios-pseudo-fullscreen");
      setFullscreen(active);
      if (!active) {
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
        try { orientation.unlock?.(); } catch {}
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, [containerRef]);

  // Poll quality levels + playback stats.
  useEffect(() => {
    const id = window.setInterval(() => {
      const hls = hlsRef.current;
      const v = videoRef.current;
      if (hls?.levels?.length) {
        setLevels(
          hls.levels.map((l, i) => ({
            index: i,
            label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}k`,
          }))
        );
        setCurrentLevel(hls.currentLevel);
        const lvl = hls.levels[hls.currentLevel];
        if (lvl) {
          setStats((s) => ({
            ...s,
            resolution: lvl.width && lvl.height ? `${lvl.width}×${lvl.height}` : "—",
            bitrate: lvl.bitrate ? `${Math.round(lvl.bitrate / 1000)} kbps` : "—",
          }));
        }
      }
      if (v && v.buffered.length) {
        const ahead = v.buffered.end(v.buffered.length - 1) - v.currentTime;
        setStats((s) => ({ ...s, buffer: `${Math.max(0, ahead).toFixed(1)}s` }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [hlsRef, videoRef]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const jumpToLive = () => {
    const v = videoRef.current;
    const hls = hlsRef.current;
    if (!v) return;
    try {
      if (hls?.liveSyncPosition != null) v.currentTime = hls.liveSyncPosition;
      else if (v.buffered.length) v.currentTime = v.buffered.end(v.buffered.length - 1);
    } catch {}
    v.play().catch(() => {});
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    const element = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    if (document.fullscreenElement || el.classList.contains("ios-pseudo-fullscreen")) {
      el.classList.remove("ios-pseudo-fullscreen");
      if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {});
      else doc.webkitExitFullscreen?.();
      try { (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.(); } catch {}
      setFullscreen(false);
      return;
    }
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
      else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else {
        el.classList.add("ios-pseudo-fullscreen");
        setFullscreen(true);
      }
      try {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
        await orientation.lock?.("landscape");
      } catch {}
    } catch {
      if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else {
        el.classList.add("ios-pseudo-fullscreen");
        setFullscreen(true);
      }
    }
  };

  const setLevel = (index: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setCurrentLevel(index);
    setShowSettings(false);
  };

  const iconBtn =
    "flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg text-player-foreground/90 hover:text-player-foreground hover:bg-player-foreground/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70";

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Stats panel */}
      {showStats && (
        <div className="absolute bottom-full right-3 mb-2 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 px-3 py-2 text-[11px] text-white/85 space-y-1 min-w-[150px]">
          <p className="font-semibold text-white text-xs mb-1">Stream stats</p>
          <p className="flex justify-between gap-4"><span className="text-white/55">Resolution</span>{stats.resolution}</p>
          <p className="flex justify-between gap-4"><span className="text-white/55">Bitrate</span>{stats.bitrate}</p>
          <p className="flex justify-between gap-4"><span className="text-white/55">Buffer</span>{stats.buffer}</p>
        </div>
      )}

      {/* Quality panel */}
      {showSettings && (
        <div className="absolute bottom-full right-3 mb-2 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 py-1 text-xs text-white/85 min-w-[130px]">
          <p className="px-3 py-1.5 font-semibold text-white text-[11px] uppercase tracking-wide">Quality</p>
          <button
            onClick={() => setLevel(-1)}
            className={cn("w-full text-left px-3 py-1.5 hover:bg-white/10", currentLevel === -1 && "text-primary font-semibold")}
          >
            Auto
          </button>
          {levels.map((l) => (
            <button
              key={l.index}
              onClick={() => setLevel(l.index)}
              className={cn("w-full text-left px-3 py-1.5 hover:bg-white/10", currentLevel === l.index && "text-primary font-semibold")}
            >
              {l.label}
            </button>
          ))}
          {levels.length === 0 && <p className="px-3 py-1.5 text-white/50">Auto only</p>}
        </div>
      )}

      <div className="bg-gradient-to-t from-black via-black/70 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
        <div className="flex items-center gap-0 sm:gap-1">
          <Button variant="ghost" size="icon" onClick={togglePlay} className={iconBtn} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6" fill="currentColor" />}
          </Button>

          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <Button variant="ghost" size="icon" onClick={toggleMute} className={iconBtn} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className={cn(
                "h-1 accent-primary cursor-pointer transition-all",
                showVolume ? "w-16 sm:w-20 opacity-100 mr-1" : "w-0 opacity-0 pointer-events-none"
              )}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={jumpToLive}
            className="ml-1 h-8 gap-1.5 rounded-full px-2.5 text-[10px] font-black uppercase text-player-foreground/90 hover:text-player-foreground hover:bg-player-foreground/10 sm:text-[11px]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            Live
          </Button>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" onClick={() => onReload?.()} className={`${iconBtn} hidden min-[360px]:flex`} aria-label="Reload stream">
            <RotateCw className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowStats((s) => !s); setShowSettings(false); }}
            className={cn(iconBtn, "hidden sm:flex", showStats && "bg-player-foreground/10 text-player-foreground")}
            aria-label="Stream stats"
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowSettings((s) => !s); setShowStats(false); }}
            className={cn(iconBtn, showSettings && "bg-white/10 text-white")}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className={iconBtn} aria-label="Fullscreen">
            {fullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </Button>
        </div>

        {/* Broadcast metadata */}
        {channelLabel && (
          <div className="mt-1 mb-2 px-1 min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
              {channelLabel}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                {stats.resolution !== "—" ? stats.resolution.split("×")[1] + "p" : "HD"}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/50 truncate">
                MetsXMFanZone Broadcast
              </span>
            </div>
          </div>
        )}

        {/* Live rail */}
        <div className="relative mx-1 h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[85%] bg-primary" />
          <div className="absolute inset-y-0 right-0 w-[15%] bg-white/40" />
        </div>
      </div>

    </div>
  );
}

export default StreamControls;
