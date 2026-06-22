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
    // Make this element look "fullscreen" so NewPostAlert portals into it.
    (document as any).__iosPseudoFs = container;
    Object.defineProperty(document, "webkitFullscreenElement", {
      configurable: true,
      get: () => (document as any).__iosPseudoFs || null,
    });
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

    // Override native iOS fullscreen entry
    try {
      (v as any).webkitEnterFullscreen = () => enterPseudo();
      (v as any).webkitEnterFullScreen = () => enterPseudo();
      (v as any).requestFullscreen = () => {
        enterPseudo();
        return Promise.resolve();
      };
    } catch {
      // ignore
    }

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

  // Intercept Clappr's fullscreen button (it calls element.requestFullscreen)
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

  useEffect(() => {
    if (!source || !containerRef.current) return;

    let destroyed = false;
    let cleanupIos: (() => void) | null = null;

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
        playInline: true,
        playsinline: true,
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

      // iOS pseudo-fullscreen so overlays (NewPostAlert) remain visible.
      // iOS Safari's native <video> fullscreen is an OS layer that no DOM
      // can paint on top of — so we prevent it and use CSS fullscreen instead.
      cleanupIos = setupIosPseudoFullscreen(containerRef.current!);
    };

    init();

    return () => {
      destroyed = true;
      if (cleanupIos) cleanupIos();
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


  // CDN-loaded Clappr for pages that don't pass a direct stream URL (e.g. MetsXMFanZone)
  const cdnContainerRef = useRef<HTMLDivElement>(null);
  const cdnPlayerRef = useRef<any>(null);

  useEffect(() => {
    if (source || !cdnContainerRef.current) return;

    let destroyed = false;

    const initCdnPlayer = () => {
      if (destroyed || !cdnContainerRef.current) return;
      if (typeof (window as any).Clappr === "undefined") return;

      const player = new (window as any).Clappr.Player({
        source: "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8",
        parentId: "#clappr-player",
        width: "100%",
        height: "100%",
        autoPlay: true,
      });

      cdnPlayerRef.current = player;
    };

    if (typeof (window as any).Clappr !== "undefined") {
      initCdnPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/clappr@latest/dist/clappr.min.js";
      script.async = true;
      script.onload = initCdnPlayer;
      document.head.appendChild(script);
    }

    return () => {
      destroyed = true;
      if (cdnPlayerRef.current) {
        try {
          cdnPlayerRef.current.destroy();
        } catch (e) {
          // ignore cleanup errors
        }
      }
      cdnPlayerRef.current = null;
    };
  }, [source]);

  if (!source) {
    return (
      <div
        id="clappr-player"
        ref={cdnContainerRef}
        className="w-full h-full bg-black"
        style={{ position: "relative", minHeight: 320 }}
      />
    );
  }

  return <div ref={containerRef} className="w-full h-full bg-black" />;
});

export default ClapprPlayer;
