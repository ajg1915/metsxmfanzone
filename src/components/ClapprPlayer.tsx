import { memo, useRef, useEffect, useState, useCallback } from "react";
import Clappr from "@clappr/player";
import { Loader2, AlertCircle, RotateCw, Volume2, Play } from "lucide-react";
import { CastButton } from "./CastButton";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const PRIMARY_DEFAULT = "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8";
// Backup: MetsXM HLS proxied over HTTPS via Lovable Cloud edge function
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BACKUP_SOURCE = `https://${PROJECT_ID}.supabase.co/functions/v1/hls-proxy/hls/metsxmfanzone.m3u8`;

function loadChromecastPlugin(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if ((window as any).ChromecastPlugin) {
      resolve((window as any).ChromecastPlugin);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/clappr-chromecast-plugin@0.1.1/dist/clappr-chromecast-plugin.min.js";
    script.async = true;
    script.onload = () => resolve((window as any).ChromecastPlugin || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (navigator as any).maxTouchPoints > 1);
};

function setupIosPseudoFullscreen(container: HTMLElement): () => void {
  if (!isIos()) return () => {};

  let cancelled = false;
  let video: HTMLVideoElement | null = null;
  let observer: MutationObserver | null = null;

  const fireFullscreenChange = () => {
    try {
      document.dispatchEvent(new Event("fullscreenchange"));
      document.dispatchEvent(new Event("webkitfullscreenchange"));
    } catch {
      // ignore
    }
  };

  const enterPseudo = () => {
    container.classList.add("ios-pseudo-fullscreen");
    document.body.style.overflow = "hidden";
    (document as any).__iosPseudoFs = container;
    try {
      Object.defineProperty(document, "webkitFullscreenElement", {
        configurable: true,
        get: () => (document as any).__iosPseudoFs || null,
      });
    } catch {}
    fireFullscreenChange();
  };

  const exitPseudo = () => {
    container.classList.remove("ios-pseudo-fullscreen");
    document.body.style.overflow = "";
    (document as any).__iosPseudoFs = null;
    fireFullscreenChange();
  };

  const attach = (v: HTMLVideoElement) => {
    video = v;
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    (v as any).playsInline = true;

    try {
      (v as any).webkitEnterFullscreen = () => enterPseudo();
      (v as any).webkitEnterFullScreen = () => enterPseudo();
      (v as any).requestFullscreen = () => {
        enterPseudo();
        return Promise.resolve();
      };
    } catch {}

    v.addEventListener("webkitbeginfullscreen", (e) => {
      e.preventDefault?.();
      try { (v as any).webkitExitFullscreen?.(); } catch {}
      enterPseudo();
    });
  };

  const findVideo = () => {
    const v = container.querySelector("video") as HTMLVideoElement | null;
    if (v && v !== video) attach(v);
  };

  findVideo();
  observer = new MutationObserver(() => {
    if (cancelled) return;
    findVideo();
  });
  observer.observe(container, { childList: true, subtree: true });

  const clickHandler = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (target.closest('[data-fullscreen], .fullscreen-icon, .icon-fullscreen, [aria-label*="ull" i]')) {
      e.preventDefault();
      e.stopPropagation();
      if (container.classList.contains("ios-pseudo-fullscreen")) exitPseudo();
      else enterPseudo();
    }
  };
  container.addEventListener("click", clickHandler, true);

  return () => {
    cancelled = true;
    observer?.disconnect();
    container.removeEventListener("click", clickHandler, true);
    if (container.classList.contains("ios-pseudo-fullscreen")) exitPseudo();
  };
}

export const ClapprPlayer = memo(function ClapprPlayer({
  source,
  showChrome = true,
  pageTitle = "Live Stream",
}: ClapprPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [usingBackup, setUsingBackup] = useState(false);

  const primarySource = source || FALLBACK_SOURCE;
  const hasBackup = !!source && source !== FALLBACK_SOURCE;
  const effectiveSource = usingBackup && hasBackup ? FALLBACK_SOURCE : primarySource;

  const handleUnmute = useCallback(() => {
    try {
      const p = playerRef.current;
      if (!p) return;
      p.setVolume?.(100);
      p.play?.();
      setNeedsUnmute(false);
    } catch {}
  }, []);

  const handleTapPlay = useCallback(() => {
    try {
      const p = playerRef.current;
      if (!p) return;
      p.play?.();
      const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
      v?.play?.().catch(() => {});
      setNeedsTap(false);
    } catch {}
  }, []);

  const handleRetry = useCallback(() => {
    setStatus("loading");
    setUsingBackup(false);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let cleanupIos: (() => void) | null = null;
    let autoplayCheckTimer: number | undefined;
    setStatus("loading");
    setNeedsUnmute(false);
    setNeedsTap(false);

    const init = async () => {
      if (destroyed || !containerRef.current) return;

      (window as any).Clappr = Clappr;

      try {
        const player = new (Clappr as any).Player({
          parent: containerRef.current,
          source: effectiveSource,
          width: "100%",
          height: "100%",
          autoPlay: true,
          mute: true,
          chromeless: false, // always show controls so users can access fullscreen/volume/cast
          playInline: true,
          playsinline: true,
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 10,
            maxBufferLength: 8,
            maxMaxBufferLength: 20,
            maxBufferSize: 30 * 1000 * 1000,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
            liveDurationInfinity: true,
            highBufferWatchdogPeriod: 1,
            nudgeMaxRetry: 10,
            manifestLoadingTimeOut: 8000,
            manifestLoadingMaxRetry: 4,
            levelLoadingTimeOut: 8000,
            fragLoadingTimeOut: 12000,
            startFragPrefetch: true,
            progressive: true,
          },
          playback: {
            preload: 'auto',
            hlsMinimumDvrSize: 0,
          } as any,
          mediacontrol: { seekbar: "#E94560", buttons: "#E94560" },
          events: {
            onReady: () => {
              if (destroyed) return;
              setStatus("ready");
              setNeedsUnmute(true);
              // If autoplay is blocked, video stays paused — prompt a tap.
              autoplayCheckTimer = window.setTimeout(() => {
                if (destroyed) return;
                const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
                if (v && v.paused) {
                  v.play().catch(() => setNeedsTap(true));
                  // Re-check shortly after
                  window.setTimeout(() => {
                    if (destroyed) return;
                    if (v.paused) setNeedsTap(true);
                  }, 800);
                }
              }, 1500);
            },
            onPlay: () => {
              if (destroyed) return;
              setStatus("ready");
              setNeedsTap(false);
            },
            onError: (err: any) => {
              if (destroyed) return;
              console.error("[ClapprPlayer] error:", err);
              if (hasBackup && !usingBackup) {
                console.warn("[ClapprPlayer] primary failed, switching to backup HLS");
                setUsingBackup(true);
                setStatus("loading");
              } else {
                setStatus("error");
              }
            },
          },
        });

        playerRef.current = player;
        cleanupIos = setupIosPseudoFullscreen(containerRef.current!);
      } catch (e) {
        console.error("[ClapprPlayer] init failed:", e);
        if (!destroyed) setStatus("error");
      }
    };

    init();

    return () => {
      destroyed = true;
      if (autoplayCheckTimer) window.clearTimeout(autoplayCheckTimer);
      if (cleanupIos) cleanupIos();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }
      playerRef.current = null;
    };
  }, [effectiveSource, showChrome, pageTitle, retryKey]);

  return (
    <div className="relative w-full h-full aspect-video bg-black overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      <CastButton source={effectiveSource} title={pageTitle} />

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-2 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-white/80">Loading stream…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 p-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm font-medium">Stream unavailable</p>
          <p className="text-xs text-white/70">Stream goes live 30 minutes before game time</p>
          <button
            onClick={handleRetry}
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {status === "ready" && needsUnmute && (
        <button
          onClick={handleUnmute}
          className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5" /> Tap to unmute
        </button>
      )}

      {status === "ready" && needsTap && (
        <button
          onClick={handleTapPlay}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm text-white transition-colors hover:bg-black/80"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/40 animate-pulse">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground ml-1" fill="currentColor" />
          </div>
          <p className="text-sm sm:text-base font-bold">Tap to play</p>
          <p className="text-[11px] sm:text-xs text-white/70 max-w-[280px] text-center px-4">
            Your browser blocked autoplay. Tap anywhere on the player to start the stream.
          </p>
        </button>
      )}

      {usingBackup && status === "ready" && (
        <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-black text-[10px] font-bold backdrop-blur-md">
          BACKUP FEED
        </div>
      )}
    </div>
  );
});

export default ClapprPlayer;
