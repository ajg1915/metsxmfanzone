import { useEffect, useRef } from "react";
import Clappr from "@clappr/player";

// Expose Clappr globally so the UMD chromecast plugin can attach
if (typeof window !== "undefined") {
  (window as any).Clappr = Clappr;
}

// Lazy-load Chromecast plugin (UMD, needs global Clappr)
let chromecastLoading: Promise<any> | null = null;
function loadChromecastPlugin(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).ChromecastPlugin) return Promise.resolve((window as any).ChromecastPlugin);
  if (chromecastLoading) return chromecastLoading;
  chromecastLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/clappr-chromecast-plugin@0.1.1/dist/clappr-chromecast-plugin.min.js";
    s.async = true;
    s.onload = () => resolve((window as any).ChromecastPlugin || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return chromecastLoading;
}

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const DEFAULT_SOURCE =
  "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8";

// Load Google Cast SDK once
let castSdkLoading: Promise<void> | null = null;
function loadCastSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).__castSdkLoaded) return Promise.resolve();
  if (castSdkLoading) return castSdkLoading;
  castSdkLoading = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    s.async = true;
    s.onload = () => {
      (window as any).__castSdkLoaded = true;
      resolve();
    };
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return castSdkLoading;
}

export function ClapprPlayer({
  pageTitle = "Live Stream",
  pageDescription = "Watch live content",
  source = DEFAULT_SOURCE,
  showChrome = true,
}: ClapprPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !source) return;
    const container = containerRef.current;

    let cancelled = false;

    Promise.all([loadCastSdk(), loadChromecastPlugin()]).then(([, ChromecastPlugin]) => {
      if (cancelled || !containerRef.current) return;

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
        plugins: ChromecastPlugin ? [ChromecastPlugin] : [],
        chromecast: {
          appId: "CC1AD845", // default Styled Media Receiver
          media: {
            title: pageTitle,
            subtitle: pageDescription,
          },
        },
        playback: {
          playInline: true,
          hlsjsConfig: { enableWorker: true },
          // Enables native AirPlay button on iOS/macOS Safari
          controls: true,
        },
      });

      // Enable AirPlay attributes on underlying <video>
      setTimeout(() => {
        const vid = container.querySelector("video");
        if (vid) {
          vid.setAttribute("x-webkit-airplay", "allow");
          vid.setAttribute("airplay", "allow");
          (vid as any).disableRemotePlayback = false;
        }
      }, 500);

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      container.replaceChildren();
    };
  }, [source, pageTitle, pageDescription]);

  const playerEl = (
    <div
      id="clappr"
      className="relative w-full"
      style={{ minHeight: 320, height: "100%", marginBottom: 25 }}
    >
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );

  if (!showChrome) return playerEl;

  return (
    <div className="mb-8 rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{pageTitle}</h3>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>
      <div className="p-4 sm:p-6">
        <div className="aspect-video relative">{playerEl}</div>
      </div>
    </div>
  );
}

export default ClapprPlayer;
