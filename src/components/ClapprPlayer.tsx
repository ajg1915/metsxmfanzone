import { useEffect, useRef, useState } from "react";
import Clappr from "@clappr/player";
import { Volume2 } from "lucide-react";

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
  const [audioOn, setAudioOn] = useState(false);

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
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full [&>.clappr]:absolute [&>.clappr]:inset-0 [&>.clappr]:w-full [&>.clappr]:h-full"
      />
      {!audioOn && (
        <button
          onClick={enableAudio}
          aria-label="Turn on audio"
          title="Turn on audio"
          className="group absolute top-3 right-3 z-20 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 hover:bg-black/85 text-white shadow-lg backdrop-blur-sm transition-colors"
        >
          <Volume2 className="w-4 h-4" />
          <span className="text-xs font-semibold">Tap for audio</span>
        </button>
      )}
    </div>
  );


  if (!showChrome) return playerEl;

  return (
    <div className="mb-8 rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{pageTitle}</h3>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>
      <div className="p-4 sm:p-6">{playerEl}</div>
    </div>
  );
}

export default ClapprPlayer;
