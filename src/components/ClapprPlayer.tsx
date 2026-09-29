import { memo, useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, AlertCircle, RotateCw, Play, Volume2 } from "lucide-react";
import { CastButton } from "./CastButton";
import { StreamIssueDialog } from "./StreamIssueDialog";
import { StreamControls } from "./player/StreamControls";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";
import { toSecureStreamUrl, toCorsProxyUrl, isInsecureUrl } from "@/lib/streamProxy";
import { playWithSound, unmuteFromTap } from "@/lib/playerSound";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  /** Looping standby playlist shown while `source` isn't live. */
  fallbackSource?: string;
  showChrome?: boolean;
  streamId?: string;
}

const isMobile = (() => {
  if (typeof navigator === "undefined") return false;
  return /Android|iPad|iPhone|iPod|Mobile/i.test(navigator.userAgent || "");
})();

const isIos = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (navigator as any).maxTouchPoints > 1);
};

export const ClapprPlayer = memo(function ClapprPlayer({
  source,
  fallbackSource,
  pageTitle = "Live Stream",
  streamId,
}: ClapprPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [needsTap, setNeedsTap] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const notifiedRef = useRef(false);

  const effectiveSource = source?.trim() || "";
  const standbySource = fallbackSource?.trim() || "";
  const [onStandby, setOnStandby] = useState(false);
  const activeSource = onStandby && standbySource ? standbySource : effectiveSource;

  // A new main feed always starts from the main feed, not the standby.
  useEffect(() => {
    setOnStandby(false);
  }, [effectiveSource]);

  // While the standby loop plays, check the main feed and switch back once it's live.
  useEffect(() => {
    if (!onStandby || !effectiveSource) return;
    let cancelled = false;
    let lastPlaylist = "";
    const check = async () => {
      // Direct first, then via the proxy in case the server blocks cross-site requests.
      for (const url of [effectiveSource, toCorsProxyUrl(effectiveSource)]) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const text = await res.text();
          if (!text.includes("#EXT")) return;
          // A live feed rewrites its playlist; an old leftover file doesn't change.
          if (!cancelled && lastPlaylist && text !== lastPlaylist) setOnStandby(false);
          lastPlaylist = text;
          return;
        } catch {}
      }
    };
    check();
    const timer = window.setInterval(check, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onStandby, effectiveSource]);

  const handleTapPlay = useCallback(() => {
    // A tap counts as permission, so start with sound.
    unmuteFromTap(videoRef.current);
    setNeedsTap(false);
    setNeedsSound(false);
  }, []);

  const handleTapSound = useCallback(() => {
    unmuteFromTap(videoRef.current);
    setNeedsSound(false);
  }, []);

  const handleRetry = useCallback(() => {
    setStatus("loading");
    notifiedRef.current = false;
    setOnStandby(false);
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
    if (!activeSource) {
      setStatus("error");
      return;
    }

    let destroyed = false;
    let autoplayTimer: number | undefined;
    setStatus("loading");
    setNeedsTap(false);

    // Try the link directly first, then through our HTTPS proxy, which adds the
    // CORS headers browsers need when the stream server doesn't send them.
    const candidates = Array.from(
      new Set(
        [
          activeSource,
          isInsecureUrl(activeSource) ? toSecureStreamUrl(activeSource) : "",
          toCorsProxyUrl(activeSource),
        ].filter(Boolean)
      )
    );

    // With a standby ready, give up on a dead main feed quickly so viewers aren't
    // left on a blank player while it retries.
    const quickFail = !onStandby && !!standbySource;

    let index = 0;
    let mediaRecoveries = 0;
    let networkRetries = 0;
    let retryTimer: number | undefined;
    let watchdogTimer: number | undefined;
    // Set once real video data arrives, so a paused-by-autoplay player isn't treated as dead.
    let gotMedia = false;

    const onPlaying = () => {
      if (destroyed) return;
      gotMedia = true;
      mediaRecoveries = 0;
      networkRetries = 0;
      setStatus("ready");
      setNeedsTap(false);
    };

    const tryAutoplay = () => {
      playWithSound(
        video,
        () => { if (!destroyed) setNeedsSound(true); },
        () => { if (!destroyed) setNeedsTap(true); },
      );
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
        // Main feed is down: play the standby loop instead of an error screen.
        if (!onStandby && standbySource) {
          setStatus("loading");
          setOnStandby(true);
          return;
        }
        setStatus("error");
        // Live feeds come and go — keep trying quietly from the top.
        index = 0;
        retryTimer = window.setTimeout(() => {
          if (destroyed) return;
          setStatus("loading");
          load();
        }, 15000);
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
          gotMedia = true;
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
        backBufferLength: isMobile ? 15 : 8,
        maxBufferLength: isMobile ? 18 : 10,
        maxMaxBufferLength: isMobile ? 30 : 20,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: isMobile ? 8 : 6,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 2,
        nudgeMaxRetry: 20,
        manifestLoadingTimeOut: quickFail ? 8000 : 20000,
        manifestLoadingMaxRetry: quickFail ? 1 : 6,
        levelLoadingTimeOut: quickFail ? 8000 : 20000,
        levelLoadingMaxRetry: quickFail ? 1 : 6,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 10,
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
      hls.on(Hls.Events.FRAG_BUFFERED, () => { gotMedia = true; });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (destroyed) return;

        // Non-fatal buffer stalls are common on mobile networks — nudge past them.
        if (!data?.fatal) {
          if (data?.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            try {
              const live = hls.liveSyncPosition;
              if (typeof live === "number" && live > 0) video.currentTime = live;
              video.play().catch(() => {});
            } catch {}
          }
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 3) {
          mediaRecoveries += 1;
          try {
            if (mediaRecoveries > 1) hls.swapAudioCodec();
            hls.recoverMediaError();
            return;
          } catch {}
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < (quickFail ? 1 : 3)) {
          networkRetries += 1;
          try {
            hls.startLoad();
            return;
          } catch {}
        }

        console.error("[Player] fatal HLS error:", data.type, data.details);
        fail();
      });
    };


    // Standby is a finished playlist, so restart it whenever it reaches the end.
    const onEnded = () => {
      if (destroyed || !onStandby) return;
      try { video.currentTime = 0; } catch {}
      video.play().catch(() => {});
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    load();

    // If the main feed never actually starts (e.g. an old playlist left on the
    // server), move to the standby instead of sitting on a blank player.
    if (quickFail) {
      watchdogTimer = window.setTimeout(() => {
        if (destroyed || gotMedia) return;
        notifyAdmins();
        setStatus("loading");
        setOnStandby(true);
      }, 25000);
    }

    return () => {
      destroyed = true;
      if (autoplayTimer) window.clearTimeout(autoplayTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      try { video.removeAttribute("src"); video.load(); } catch {}
    };
  }, [activeSource, onStandby, standbySource, retryKey, notifyAdmins]);

  return (
    <div ref={containerRef} className="stream-player relative h-full w-full aspect-video overflow-hidden bg-player group">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain bg-player"
        playsInline
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
        {...{ "webkit-playsinline": "true" }}
        x-webkit-airplay="allow"
        crossOrigin={isIos() ? undefined : "anonymous"}
      />


      {/* Top-left so the cast and issue buttons don't cover the logo in the top-right. */}
      <div className="absolute left-2 top-2 z-40 flex items-center gap-2 sm:left-3 sm:top-3">
        <CastButton source={activeSource} title={pageTitle} />
        <StreamIssueDialog streamId={streamId} streamTitle={pageTitle} video={videoRef.current} compact />
      </div>


      {status === "ready" && (
        <StreamControls
          videoRef={videoRef}
          hlsRef={hlsRef}
          containerRef={containerRef}
          onReload={handleRetry}
          channelLabel={pageTitle}
        />
      )}


      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player/60 text-player-foreground gap-2 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-player-foreground/80">Loading stream…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player/80 text-player-foreground gap-3 p-4 text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm font-medium">Stream unavailable</p>
          <p className="text-xs text-player-foreground/70">Stream goes live 30 minutes before game time</p>
          <Button
            onClick={handleRetry}
            size="sm"
            className="mt-1 text-xs"
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {status === "ready" && needsSound && !needsTap && (
        <button
          type="button"
          onClick={handleTapSound}
          className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-2xl shadow-primary/40 animate-pulse"
        >
          <Volume2 className="h-5 w-5" /> Tap for sound
        </button>
      )}

      {status === "ready" && needsTap && (
        <Button
          onClick={handleTapPlay}
          variant="ghost"
          className="absolute inset-0 z-30 flex h-full w-full flex-col items-center justify-center gap-3 rounded-none bg-player/70 text-player-foreground backdrop-blur-sm hover:bg-player/80"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/40 animate-pulse">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground ml-1" fill="currentColor" />
          </div>
          <p className="text-sm sm:text-base font-bold">Tap to play</p>
          <p className="text-[11px] sm:text-xs text-player-foreground/70 max-w-[280px] text-center px-4">
            Your browser blocked autoplay. Tap anywhere on the player to start the stream.
          </p>
        </Button>
      )}
    </div>
  );
});

export default ClapprPlayer;
