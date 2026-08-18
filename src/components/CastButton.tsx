import { useEffect, useRef, useState, useCallback } from "react";
import { Cast } from "lucide-react";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: any;
    chrome?: any;
  }
}

interface CastButtonProps {
  source: string;
  title?: string;
  poster?: string;
}

const CAST_FRAMEWORK_SRC =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

let frameworkReady: Promise<boolean> | null = null;

function frameworkAvailable() {
  return !!(window.cast?.framework && window.chrome?.cast?.media);
}

/**
 * Resolves once the Cast SDK is usable.
 * The SDK is also loaded from index.html, so it may already have fired its
 * global callback before this component mounts — polling is the only reliable
 * way to detect that case (assigning __onGCastApiAvailable too late = never fires).
 */
function loadCastFramework(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (frameworkReady) return frameworkReady;

  frameworkReady = new Promise((resolve) => {
    if (frameworkAvailable()) {
      resolve(true);
      return;
    }

    // Chain (don't clobber) any existing callback.
    const prev = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      try {
        prev?.(isAvailable);
      } catch {}
      if (isAvailable && frameworkAvailable()) resolve(true);
    };

    if (!document.querySelector(`script[src="${CAST_FRAMEWORK_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = CAST_FRAMEWORK_SRC;
      s.async = true;
      document.head.appendChild(s);
    }

    // Poll as the primary detection mechanism (~15s).
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (frameworkAvailable()) {
        window.clearInterval(timer);
        resolve(true);
      } else if (tries > 60) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });

  return frameworkReady;
}

export function CastButton({ source, title, poster }: CastButtonProps) {
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const contextRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    loadCastFramework().then((ok) => {
      if (cancelled || !ok) return;

      const context = window.cast.framework.CastContext.getInstance();
      contextRef.current = context;

      try {
        context.setOptions({
          receiverApplicationId:
            window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
          // Keep the session alive if the user navigates within the app.
          resumeSavedSession: true,
        });
      } catch (e) {
        console.warn("[Cast] setOptions failed:", e);
      }

      const onStateChanged = (event: any) => {
        if (cancelled) return;
        setConnected(String(event.castState) === "CONNECTED");
      };

      try {
        setConnected(String(context.getCastState()) === "CONNECTED");
      } catch {}

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onStateChanged
      );
      // Show the button whenever the SDK works — Chrome opens its own device
      // picker on click, so hiding on NO_DEVICES_AVAILABLE just looks "blocked".
      setReady(true);

      cleanup = () => {
        try {
          context.removeEventListener(
            window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            onStateChanged
          );
        } catch {}
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const handleCast = useCallback(async () => {
    // Cast is blocked inside iframes (Lovable preview / embeds) — open the real site.
    const inIframe = window.self !== window.top;
    if (inIframe) {
      window.open(window.location.href, "_blank", "noopener");
      return;
    }

    const context = contextRef.current;

    // Fallback: Remote Playback API (Android Chrome / Edge) shows the system
    // device picker even when the Cast framework finds no receivers itself.
    const remotePrompt = async () => {
      const video = document.querySelector("video") as any;
      if (video?.remote?.prompt) {
        try {
          await video.remote.prompt();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };

    if (!context || !window.chrome?.cast) {
      await remotePrompt();
      return;
    }

    try {
      if (connected) {
        context.endCurrentSession(true);
        setConnected(false);
        return;
      }

      await context.requestSession();

      const session = context.getCurrentSession();
      if (!session) return;

      const contentType = source.includes(".m3u8")
        ? "application/x-mpegURL"
        : source.includes(".mpd")
        ? "application/dash+xml"
        : "video/mp4";

      const mediaInfo = new window.chrome.cast.media.MediaInfo(
        source,
        contentType
      );
      mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || "Live Stream";
      if (poster) mediaInfo.metadata.images = [{ url: poster }];

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
    } catch (e: any) {
      const code = typeof e === "string" ? e : e?.code || e?.message;
      console.warn("[Cast] cast failed:", code);
      // "cancel" also fires when the picker had nothing to show — try the
      // browser's native remote playback picker before giving up.
      if (code === "cancel" || code === "receiver_unavailable") {
        await remotePrompt();
      }
    }
  }, [source, title, poster, connected]);

  if (!ready && !castSupported) return null;


  return (
    <button
      onClick={handleCast}
      aria-label={connected ? "Casting (stop)" : "Cast to TV"}
      title={connected ? "Casting — tap to stop" : "Cast to TV"}
      className={`absolute top-3 left-3 z-30 inline-flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-md border text-xs font-semibold transition-colors ${
        connected
          ? "bg-primary text-primary-foreground border-primary/40"
          : "bg-black/70 hover:bg-black/90 text-white border-white/20"
      }`}
    >
      <Cast className="w-3.5 h-3.5" />
      {connected ? "Casting" : "Cast"}
    </button>
  );
}

export default CastButton;
