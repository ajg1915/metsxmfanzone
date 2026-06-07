import { useEffect, useRef, useState } from "react";
import Clappr from "@clappr/player";
import { Cast, Tv, Volume2, Airplay } from "lucide-react";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const DEFAULT_SOURCE =
  "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8";

export function ClapprPlayer({
  pageTitle = "Live Stream",
  pageDescription = "Watch live content",
  source = DEFAULT_SOURCE,
  showChrome = true,
}: ClapprPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const retryTimerRef = useRef<number | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  // Chromecast init
  useEffect(() => {
    const initChromecast = () => {
      const chrome = (window as any).chrome;
      if (!chrome?.cast) return;
      const sessionRequest = new chrome.cast.SessionRequest(
        chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
      );
      const apiConfig = new chrome.cast.ApiConfig(
        sessionRequest,
        () => setIsCasting(true),
        () => {}
      );
      chrome.cast.initialize(apiConfig, () => {}, () => {});
    };
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) initChromecast();
    };
    if ((window as any).chrome?.cast) initChromecast();
  }, []);

  const startCasting = () => {
    const chrome = (window as any).chrome;
    if (!chrome?.cast) {
      alert(
        "Chromecast is not available. Make sure you have a Chromecast device on your network."
      );
      return;
    }
    chrome.cast.requestSession(
      (session: any) => {
        setIsCasting(true);
        const mediaInfo = new chrome.cast.media.MediaInfo(
          source,
          "application/x-mpegURL"
        );
        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        session.loadMedia(request, () => {}, () => {});
      },
      (err: any) => {
        if (err.code !== "cancel") console.error("[Cast] Request error:", err);
      }
    );
  };

  // Initialize Clappr player with low-latency HLS tuning
  useEffect(() => {
    if (!containerRef.current || !source) return;
    const container = containerRef.current;

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    }
    container.replaceChildren();

    // Aggressive low-latency hls.js config to reduce lag/buffering on live HLS.
    const hlsLowLatencyConfig = {
      lowLatencyMode: true,
      backBufferLength: 8,
      maxBufferLength: 12,
      maxMaxBufferLength: 20,
      maxBufferSize: 30 * 1000 * 1000,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      maxLiveSyncPlaybackRate: 1.3,
      enableWorker: true,
      startLevel: -1,
      abrEwmaDefaultEstimate: 1_000_000,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      fragLoadingMaxRetry: 6,
    };

    const player = new (Clappr as any).Player({
      source,
      parent: container,
      width: "100%",
      height: "100%",
      autoPlay: true,
      mute: true,
      muted: true,
      playInline: true,
      disableVideoTagContextMenu: true,
      playback: {
        playInline: true,
        crossOrigin: "anonymous",
        hlsjsConfig: hlsLowLatencyConfig,
      },
      hlsjsConfig: hlsLowLatencyConfig,
      events: {
        onReady: () => {
          try {
            playerRef.current?.mute?.();
            playerRef.current?.play?.();
          } catch {}
        },
        onError: (err: any) => {
          console.error("[Clappr] Error:", err);
          retryTimerRef.current = window.setTimeout(() => {
            try {
              playerRef.current?.load(source);
              playerRef.current?.play();
            } catch {}
          }, 4000);
        },
      },
    });

    playerRef.current = player;

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try {
        player.destroy();
      } catch {}
      playerRef.current = null;
      container.replaceChildren();
    };
  }, [source]);

  // Toggle audio on user gesture (browsers block unmuted autoplay)
  const enableAudio = () => {
    try {
      playerRef.current?.unmute?.();
      playerRef.current?.setVolume?.(100);
      playerRef.current?.play?.();
      setAudioOn(true);
    } catch (e) {
      console.error("[Clappr] enableAudio error:", e);
    }
  };

  const playerEl = (
    <div
      className="clappr-wrapper relative w-full rounded-lg overflow-hidden bg-black aspect-video"
      style={{ minHeight: 320 }}
    >
      <style>{`
        .clappr-wrapper .player-play-button,
        .clappr-wrapper .play-wrapper,
        .clappr-wrapper [data-play-button],
        .clappr-wrapper .clappr-play-button,
        .clappr-wrapper .media-control-center {
          display: none !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full [&>.clappr]:absolute [&>.clappr]:inset-0 [&>.clappr]:w-full [&>.clappr]:h-full"
      />
      {!audioOn && (
        <button
          onClick={enableAudio}
          aria-label="Turn on audio"
          title="Turn on audio"
          className="group absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/30 hover:bg-black/40 transition-colors"
        >
          <span className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 group-hover:bg-primary text-primary-foreground shadow-2xl ring-4 ring-white/20 transition-transform group-hover:scale-105">
            <Volume2 className="w-8 h-8 sm:w-9 sm:h-9" />
          </span>
          <span className="px-3 py-1 rounded-full bg-black/70 text-white text-xs font-semibold backdrop-blur-sm">
            Tap to turn on audio
          </span>
        </button>
      )}
    </div>
  );

  if (!showChrome) return playerEl;

  return (
    <div className="mb-8 rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{pageTitle}</h3>
          <p className="text-sm text-muted-foreground">{pageDescription}</p>
        </div>
        <button
          onClick={startCasting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
          title="Cast to TV"
        >
          {isCasting ? <Tv className="w-4 h-4" /> : <Cast className="w-4 h-4" />}
          <span className="hidden sm:inline">{isCasting ? "Casting" : "Cast"}</span>
        </button>
      </div>
      <div className="p-4 sm:p-6 space-y-3">
        {playerEl}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cast className="w-3.5 h-3.5" />
          <span>
            Cast to TV via the Cast button above or your browser's cast menu.
          </span>
        </div>
      </div>
    </div>
  );
}

export default ClapprPlayer;
