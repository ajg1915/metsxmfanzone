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

let frameworkLoading: Promise<boolean> | null = null;

function loadCastFramework(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (frameworkLoading) return frameworkLoading;

  frameworkLoading = new Promise((resolve) => {
    // Already loaded
    if (window.cast?.framework) {
      resolve(true);
      return;
    }

    // Set the callback BEFORE the script loads
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      resolve(!!isAvailable && !!window.cast?.framework);
    };

    const existing = document.querySelector(
      `script[src="${CAST_FRAMEWORK_SRC}"]`
    );
    if (existing) return;

    const s = document.createElement("script");
    s.src = CAST_FRAMEWORK_SRC;
    s.async = true;
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

  return frameworkLoading;
}

export function CastButton({ source, title, poster }: CastButtonProps) {
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const contextRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    loadCastFramework().then((ok) => {
      if (cancelled || !ok || !window.cast?.framework) return;

      const context = window.cast.framework.CastContext.getInstance();
      contextRef.current = context;

      try {
        context.setOptions({
          receiverApplicationId:
            window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy:
            window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
      } catch (e) {
        console.warn("[Cast] setOptions failed:", e);
        return;
      }

      const onAvailability = (event: any) => {
        if (cancelled) return;
        // CastState: NO_DEVICES_AVAILABLE | NOT_CONNECTED | CONNECTING | CONNECTED
        const state = event.castState;
        setAvailable(state !== "NO_DEVICES_AVAILABLE");
        setConnected(state === "CONNECTED");
      };

      const initialState = context.getCastState();
      setAvailable(initialState !== "NO_DEVICES_AVAILABLE");
      setConnected(initialState === "CONNECTED");

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onAvailability
      );

      return () => {
        try {
          context.removeEventListener(
            window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            onAvailability
          );
        } catch {}
      };
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCast = useCallback(async () => {
    const context = contextRef.current;
    if (!context || !window.chrome?.cast) return;

    try {
      // Request a session if not connected
      if (!connected) {
        await context.requestSession();
      }

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
    } catch (e) {
      console.warn("[Cast] cast failed:", e);
    }
  }, [source, title, poster, connected]);

  if (!available) return null;

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
