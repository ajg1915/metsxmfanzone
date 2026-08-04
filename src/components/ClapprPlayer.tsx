import { memo, useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, AlertCircle, RotateCw, Volume2, Play } from "lucide-react";
import { CastButton } from "./CastButton";
import { supabase } from "@/integrations/supabase/client";
import { toSecureStreamUrl, toCorsProxyUrl, isInsecureUrl } from "@/lib/streamProxy";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (navigator as any).maxTouchPoints > 1);
};

export const ClapprPlayer = memo(function ClapprPlayer({
  source,
  pageTitle = "Live Stream",
}: ClapprPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const notifiedRef = useRef(false);

  const effectiveSource = source?.trim() || "";

  const handleUnmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.play().catch(() => {});
    setNeedsUnmute(false);
  }, []);

  const handleTapPlay = useCallback(() => {
    videoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {});
  }, []);

  const handleRetry = useCallback(() => {
    setStatus("loading");
    notifiedRef.current = false;
    setRetryKey((k) => k + 1);
  }, []);

  // Ask the backend to re-probe the feed so admins get an alert in the portal.
  const notifyAdmins = useCallback(() => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    supabase.functions.invoke("monitor-stream-sources").catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!effectiveSource) {
      setStatus("error");
      return;
    }

    let destroyed = false;
    let autoplayTimer: number | undefined;
    setStatus("loading");
    setNeedsUnmute(false);
    setNeedsTap(false);

    // Candidate URLs: HTTPS proxy first, then public CORS proxy, then raw.
    const candidates = Array.from(
      new Set(
        [
          toSecureStreamUrl(effectiveSource),
          isInsecureUrl(effectiveSource) ? toCorsProxyUrl(effectiveSource) : "",
          effectiveSource,
        ].filter(Boolean)
      )
    );

    let index = 0;

    const onPlaying = () => {
      if (destroyed) return;
      setStatus("ready");
      setNeedsTap(false);
      setNeedsUnmute(video.muted);
    };

    const tryAutoplay = () => {
      video.muted = true;
      video.play().catch(() => {
        if (!destroyed) setNeedsTap(true);
      });
      autoplayTimer = window.setTimeout(() => {
        if (!destroyed && video.paused) setNeedsTap(true);
      }, 1500);
    };

    const fail = () => {
      if (destroyed) return;
      index += 1;
      if (index < candidates.length) {
        load();
      } else {
        notifyAdmins();
        setStatus("error");
      }
    };

    const load = () => {
      if (destroyed) return;
      const url = candidates[index];

      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }

      // Safari / iOS: native HLS support.
      if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          if (!destroyed) setStatus("ready");
        }, { once: true });
        video.addEventListener("error", fail, { once: true });
        tryAutoplay();
        return;
      }

      if (!Hls.isSupported()) {
        setStatus("error");
        return;
      }

      const hls = new Hls({
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
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 8000,
        fragLoadingTimeOut: 12000,
        startFragPrefetch: true,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        setStatus("ready");
        tryAutoplay();
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal || destroyed) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); return; } catch {}
        }
        console.error("[Player] fatal HLS error:", data.type, data.details);
        fail();
      });
    };

    video.addEventListener("playing", onPlaying);
    load();

    return () => {
      destroyed = true;
      if (autoplayTimer) window.clearTimeout(autoplayTimer);
      video.removeEventListener("playing", onPlaying);
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      try { video.removeAttribute("src"); video.load(); } catch {}
    };
  }, [effectiveSource, retryKey, notifyAdmins]);

  return (
    <div className="relative w-full h-full aspect-video bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        controls
        autoPlay
        muted
        playsInline
        {...{ "webkit-playsinline": "true" }}
        x-webkit-airplay="allow"
        crossOrigin={isIos() ? undefined : "anonymous"}
      />
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
          className="absolute bottom-14 left-3 z-20 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 hover:bg-black/90 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-colors"
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
    </div>
  );
});

export default ClapprPlayer;
