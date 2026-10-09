import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import {
  Pause,
  Play,
  Volume2,
  Volume1,
  VolumeX,
  RotateCw,
  Settings,
  Maximize,
  Minimize,
  ChevronRight,
  ChevronLeft,
  Check,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rememberSound } from "@/lib/playerSound";

interface StreamControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hlsRef: React.MutableRefObject<Hls | null>;
  containerRef: React.RefObject<HTMLElement>;
  onReload?: () => void;
  channelLabel?: string;
}

type MenuView = "closed" | "main" | "quality";

/**
 * YouTube-style control bar shared by every live player on the site.
 * Visual layer only: playback itself (hls.js / native HLS) lives in the player.
 */
export function StreamControls({
  videoRef,
  hlsRef,
  containerRef,
  onReload,
}: StreamControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [menu, setMenu] = useState<MenuView>("closed");
  const [levels, setLevels] = useState<{ index: number; label: string; height: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [playingLevel, setPlayingLevel] = useState(-1);
  const [stats, setStats] = useState({ resolution: "—", bitrate: "—", buffer: "0.0s" });
  const [behindLive, setBehindLive] = useState(false);
  const [visible, setVisible] = useState(true);
  const hideTimer = useRef<number>();
  const menuRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const menuOpen = menu !== "closed";
  const [playerHeight, setPlayerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setPlayerHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);
  // Room above the control bar inside the player (popups must fit in it).
  const popupMaxHeight = playerHeight ? Math.max(90, playerHeight - (playerHeight < 300 ? 64 : 88)) : undefined;
  const compact = playerHeight > 0 && playerHeight < 300;

  // Close the settings menu on any tap outside it, like YouTube.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || gearRef.current?.contains(t)) return;
      setMenu("closed");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Auto-hide the controls during playback, reveal on any pointer activity.
  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setVisible(false);
    }, 3000);
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
      if (v.paused) setVisible(true);
    };
    const evts = ["play", "pause", "volumechange"] as const;
    evts.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => evts.forEach((e) => v.removeEventListener(e, sync));
  }, [videoRef]);

  useEffect(() => {
    const onFs = () => {
      const active = !!document.fullscreenElement || containerRef.current?.classList.contains("ios-pseudo-fullscreen");
      setFullscreen(!!active);
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

  // Poll quality levels, playback stats and distance from the live edge.
  useEffect(() => {
    const id = window.setInterval(() => {
      const hls = hlsRef.current;
      const v = videoRef.current;
      if (hls?.levels?.length) {
        setLevels(
          hls.levels.map((l, i) => ({
            index: i,
            height: l.height || 0,
            label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}k`,
          }))
        );
        setCurrentLevel(hls.autoLevelEnabled ? -1 : hls.currentLevel);
        setPlayingLevel(hls.currentLevel);
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
        const liveEdge = hls?.liveSyncPosition ?? v.buffered.end(v.buffered.length - 1);
        setBehindLive(liveEdge - v.currentTime > 12);
        const ahead = v.buffered.end(v.buffered.length - 1) - v.currentTime;
        setStats((s) => ({ ...s, buffer: `${Math.max(0, ahead).toFixed(1)}s` }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [hlsRef, videoRef]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    delete v.dataset.autoMuted;
    rememberSound(v);
  }, [videoRef]);

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    delete v.dataset.autoMuted;
    rememberSound(v);
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
    setBehindLive(false);
  };

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    const element = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    // TV mode: the Android TV WebView often has no Fullscreen API, so use the CSS full screen directly.
    const tvMode = document.documentElement.classList.contains("tv-mode");
    if (tvMode && !document.fullscreenElement && !el.classList.contains("ios-pseudo-fullscreen")) {
      el.classList.add("ios-pseudo-fullscreen");
      setFullscreen(true);
      return;
    }
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
  }, [containerRef, videoRef]);

  // YouTube keyboard shortcuts while the pointer is over (or focus is inside) this player.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let hovering = false;
    const isTV = () => document.documentElement.classList.contains("tv-mode");
    const goFull = () => {
      if (isTV() && !el.classList.contains("ios-pseudo-fullscreen") && !document.fullscreenElement) void toggleFullscreen();
    };
    const enter = () => { hovering = true; goFull(); };
    const onFocusIn = () => goFull();
    const leave = () => { hovering = false; };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (!hovering && !el.contains(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "enter" && isTV() && target?.tagName !== "BUTTON") { e.preventDefault(); void toggleFullscreen(); }
      else if (key === " " || key === "k") { e.preventDefault(); togglePlay(); poke(); }
      else if (key === "m") { toggleMute(); poke(); }
      else if (key === "f") { void toggleFullscreen(); }
    };
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onKey);
    };
  }, [containerRef, togglePlay, toggleMute, toggleFullscreen, poke]);

  const setLevel = (index: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setCurrentLevel(index);
    setMenu("closed");
  };

  const playingLabel = levels.find((l) => l.index === playingLevel)?.label;
  const qualitySummary = currentLevel === -1
    ? `Auto${playingLabel ? ` (${playingLabel})` : ""}`
    : levels.find((l) => l.index === currentLevel)?.label ?? "Auto";
  const hd = (levels.find((l) => l.index === playingLevel)?.height ?? 0) >= 720;

  const btn = cn(
    "relative flex shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
    compact ? "h-9 w-9" : "h-10 w-10 sm:h-12 sm:w-12"
  );
  const VolumeIcon = muted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const menuItem = cn(
    "flex w-full shrink-0 items-center gap-3 text-left text-white hover:bg-white/10",
    compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-[13px]"
  );

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 select-none transition-opacity duration-200",
        visible || menuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Stats for nerds */}
      {showStats && (
        <div
          style={{ maxHeight: popupMaxHeight }}
          className="absolute bottom-full left-2 mb-1 max-w-[calc(100%-1rem)] overflow-y-auto rounded-md bg-black/80 px-3 py-2 font-mono text-[11px] leading-5 text-white/90 sm:left-3 sm:mb-2"
        >
          <div className="mb-1 flex items-center justify-between gap-6">
            <span className="font-sans text-xs font-semibold text-white">Stats for nerds</span>
            <button onClick={() => setShowStats(false)} className="text-white/60 hover:text-white" aria-label="Close stats">✕</button>
          </div>
          <p><span className="text-white/55">Resolution </span>{stats.resolution}</p>
          <p><span className="text-white/55">Bitrate </span>{stats.bitrate}</p>
          <p><span className="text-white/55">Buffer health </span>{stats.buffer}</p>
        </div>
      )}

      {/* Settings menu (YouTube style) */}
      {menuOpen && (
        <div
          ref={menuRef}
          style={{ maxHeight: popupMaxHeight }}
          className={cn(
            "absolute bottom-full right-2 mb-1 flex max-w-[calc(100%-1rem)] flex-col overflow-y-auto rounded-xl bg-[rgba(28,28,28,0.92)] shadow-2xl backdrop-blur-sm sm:right-3 sm:mb-2",
            compact ? "min-w-[200px] py-1" : "min-w-[240px] py-2"
          )}
        >
          {menu === "main" && (
            <>
              <button className={menuItem} onClick={() => setMenu("quality")}>
                <SlidersHorizontal className="h-5 w-5" />
                <span className="flex-1">Quality</span>
                <span className="text-white/60">{qualitySummary}</span>
                <ChevronRight className="h-4 w-4 text-white/60" />
              </button>
              <button className={menuItem} onClick={() => { setShowStats((s) => !s); setMenu("closed"); }}>
                <BarChart3 className="h-5 w-5" />
                <span className="flex-1">Stats for nerds</span>
                {showStats && <Check className="h-4 w-4" />}
              </button>
              <button className={menuItem} onClick={() => { setMenu("closed"); onReload?.(); }}>
                <RotateCw className="h-5 w-5" />
                <span className="flex-1">Reload stream</span>
              </button>
            </>
          )}
          {menu === "quality" && (
            <>
              <button
                className="flex w-full items-center gap-2 border-b border-white/10 px-3 pb-2.5 pt-1 text-left text-[13px] font-medium text-white hover:bg-white/5"
                onClick={() => setMenu("main")}
              >
                <ChevronLeft className="h-4 w-4" /> Quality
              </button>
              <div className="pt-1">
                {[...levels].sort((a, b) => b.height - a.height).map((l) => (
                  <button key={l.index} className={menuItem} onClick={() => setLevel(l.index)}>
                    <span className="w-4">{currentLevel === l.index && <Check className="h-4 w-4" />}</span>
                    <span className="flex-1">
                      {l.label}
                      {l.height >= 720 && <sup className="ml-0.5 text-[9px] font-bold text-white/70">HD</sup>}
                    </span>
                  </button>
                ))}
                <button className={menuItem} onClick={() => setLevel(-1)}>
                  <span className="w-4">{currentLevel === -1 && <Check className="h-4 w-4" />}</span>
                  <span className="flex-1">Auto{playingLabel ? <span className="text-white/60"> ({playingLabel})</span> : null}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className={cn("bg-gradient-to-t from-black/80 via-black/40 to-transparent px-1.5 pb-0.5 sm:px-3 sm:pb-1", compact ? "pt-6" : "pt-12")}>
        {/* Progress bar: live streams sit at the live edge */}
        <button
          type="button"
          onClick={jumpToLive}
          aria-label="Go to live"
          className="group/bar relative mx-1 flex h-4 w-[calc(100%-0.5rem)] items-center"
        >
          <span className="relative h-[3px] w-full rounded-full bg-white/25 transition-all group-hover/bar:h-[5px]">
            <span className={cn("absolute inset-y-0 left-0 rounded-full bg-[#ff0000]", behindLive ? "w-[92%]" : "w-full")} />
          </span>
          <span
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[#ff0000] transition-transform group-hover/bar:scale-110",
              behindLive ? "left-[92%]" : "left-[calc(100%-2px)]"
            )}
          />
        </button>

        <div className="flex items-center">
          <button type="button" onClick={togglePlay} className={btn} aria-label={playing ? "Pause (k)" : "Play (k)"}>
            {playing ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" /> : <Play className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />}
          </button>

          <div
            className="flex items-center"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button type="button" onClick={toggleMute} className={btn} aria-label={muted ? "Unmute (m)" : "Mute (m)"}>
              <VolumeIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className={cn(
                "h-1 cursor-pointer accent-white transition-all duration-200",
                showVolume ? "mr-2 w-16 opacity-100 sm:w-20" : "w-0 opacity-0 pointer-events-none"
              )}
            />
          </div>

          <button
            type="button"
            onClick={jumpToLive}
            className="ml-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-[13px] font-medium text-white/90 hover:text-white"
            aria-label={behindLive ? "Go to live" : "Live"}
          >
            <span className={cn("h-2 w-2 rounded-full", behindLive ? "bg-white/50" : "bg-[#ff0000]")} />
            LIVE
          </button>

          <div className="flex-1" />

          <button
            ref={gearRef}
            type="button"
            onClick={() => setMenu((m) => (m === "closed" ? "main" : "closed"))}
            className={cn(btn, menuOpen && "text-white")}
            aria-label="Settings"
          >
            <Settings className={cn("h-6 w-6 transition-transform duration-300 sm:h-[26px] sm:w-[26px]", menuOpen && "rotate-[30deg]")} />
            {hd && (
              <span className="absolute right-1 top-2 rounded-sm bg-[#ff0000] px-[3px] text-[8px] font-bold leading-[11px] text-white sm:right-1.5 sm:top-2.5">
                HD
              </span>
            )}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()} className={btn} aria-label={fullscreen ? "Exit full screen (f)" : "Full screen (f)"}>
            {fullscreen ? <Minimize className="h-6 w-6 sm:h-7 sm:w-7" /> : <Maximize className="h-6 w-6 sm:h-7 sm:w-7" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StreamControls;
