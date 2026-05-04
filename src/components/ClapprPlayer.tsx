import { useEffect, useRef, useState } from "react";
import Clappr from "@clappr/player";
import { Cast, Tv } from "lucide-react";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const DEFAULT_SOURCE = "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8";

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

  // Initialize Chromecast
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
      alert("Chromecast is not available. Make sure you have a Chromecast device on your network.");
      return;
    }
    chrome.cast.requestSession(
      (session: any) => {
        setIsCasting(true);
        const mediaInfo = new chrome.cast.media.MediaInfo(source, "application/x-mpegURL");
        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        session.loadMedia(request, () => {}, () => {});
      },
      (err: any) => {
        if (err.code !== "cancel") console.error("[Cast] Request error:", err);
      }
    );
  };

  // Initialize Clappr player
  useEffect(() => {
    if (!containerRef.current || !source) return;
    const container = containerRef.current;

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Dispose previous instance and clear any leftover Clappr DOM so players never stack.
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    container.replaceChildren();

    const player = new (Clappr as any).Player({
      source,
      parent: container,
      width: "100%",
      height: "100%",
      autoPlay: true,
      mute: true,
      muted: true,
      playInline: true,
      playback: {
        playInline: true,
        controls: true,
        crossOrigin: "anonymous",
        hlsjsConfig: {
          liveSyncDurationCount: 3,
          maxLiveSyncPlaybackRate: 1.5,
          lowLatencyMode: true,
        },
      },
      hlsjsConfig: {
        liveSyncDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.5,
        lowLatencyMode: true,
      },
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
            if (playerRef.current) {
              try {
                playerRef.current.load(source);
                playerRef.current.mute?.();
                playerRef.current.play();
              } catch {}
            }
          }, 5000);
        },
      },
    });

    playerRef.current = player;

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try { player.destroy(); } catch {}
      playerRef.current = null;
      container.replaceChildren();
    };
  }, [source]);

  const playerEl = (
    <div
      className="clappr-wrapper relative w-full rounded-lg overflow-hidden bg-black aspect-video landscape:fixed landscape:inset-0 landscape:z-50 landscape:rounded-none landscape:aspect-auto landscape:max-h-none landscape:w-full landscape:h-full sm:landscape:relative sm:landscape:inset-auto sm:landscape:z-auto sm:landscape:rounded-lg sm:landscape:aspect-video sm:landscape:h-auto"
      style={{ minHeight: 320 }}
    >
      <div ref={containerRef} className="absolute inset-0 w-full h-full [&>.clappr]:absolute [&>.clappr]:inset-0 [&>.clappr]:w-full [&>.clappr]:h-full" />
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
            Cast to TV via the Cast button above, AirPlay icon in controls (Apple), or your browser's cast menu (Chrome).
          </span>
        </div>
      </div>
    </div>
  );
}

export default ClapprPlayer;
