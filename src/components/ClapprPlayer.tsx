import { memo, useRef, useEffect } from "react";
import Clappr from "@clappr/player";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

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

export const ClapprPlayer = memo(function ClapprPlayer({
  source,
  showChrome = true,
  pageTitle = "Live Stream",
}: ClapprPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!source || !containerRef.current) return;

    let destroyed = false;

    const init = async () => {
      const ChromecastPlugin = await loadChromecastPlugin();
      if (destroyed) return;

      // Expose Clappr globally so the Chromecast plugin can attach
      (window as any).Clappr = Clappr;

      const plugins = ChromecastPlugin ? [ChromecastPlugin] : [];

      const player = new (Clappr as any).Player({
        parent: containerRef.current,
        source,
        width: "100%",
        height: "100%",
        autoPlay: true,
        mute: false,
        chromeless: !showChrome,
        mediacontrol: { seekbar: "#E94560", buttons: "#E94560" },
        plugins,
        chromecast: ChromecastPlugin
          ? {
              appId: "9DB1A077",
              media: {
                title: pageTitle,
              },
            }
          : undefined,
      });

      playerRef.current = player;
    };

    init();

    return () => {
      destroyed = true;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore cleanup errors
        }
      }
      playerRef.current = null;
    };
  }, [source, showChrome, pageTitle]);

  // Fallback iframe for pages that don't pass a direct stream URL (e.g. MetsXMFanZone)
  if (!source) {
    return (
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <iframe
          title={pageTitle}
          referrerPolicy="origin"
          src="https://video1.getstreamhosting.com:2000/VideoPlayer/resywa2dpd?autoplay=1"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            width: "100%",
            height: "100%",
          }}
          scrolling="no"
          frameBorder="0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full bg-black" />;
});

export default ClapprPlayer;
