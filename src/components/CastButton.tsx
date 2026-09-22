import { useEffect, useRef, useState, useCallback } from "react";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import { Cast } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: any;
    chrome?: any;
  }
  namespace JSX {
    interface IntrinsicElements {
      "google-cast-launcher": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
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
  const loadedSourceRef = useRef("");

  // Show the button when casting is plausible even before the SDK reports in:
  // inside an iframe (preview/embeds) or when the browser exposes Remote Playback.
  const castSupported =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      typeof (document.createElement("video") as any).remote?.prompt ===
        "function");


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

      const loadCurrentStream = async () => {
        const session = context.getCurrentSession();
        if (!session || !source || loadedSourceRef.current === source) return;

        const contentType = source.includes(".m3u8")
          ? "application/x-mpegURL"
          : source.includes(".mpd")
          ? "application/dash+xml"
          : "video/mp4";
        const mediaInfo = new window.chrome.cast.media.MediaInfo(source, contentType);
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
        mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = title || "Live Stream";
        if (poster) mediaInfo.metadata.images = [{ url: poster }];

        try {
          await session.loadMedia(new window.chrome.cast.media.LoadRequest(mediaInfo));
          loadedSourceRef.current = source;
        } catch (error: any) {
          const code = typeof error === "string" ? error : error?.code || error?.message;
          console.warn("[Cast] media load failed:", code);
        }
      };

      const onSessionStateChanged = (event: any) => {
        const state = String(event.sessionState);
        if (state === "SESSION_STARTED" || state === "SESSION_RESUMED") {
          setConnected(true);
          void loadCurrentStream();
        }
        if (state === "SESSION_ENDED") {
          loadedSourceRef.current = "";
          setConnected(false);
        }
      };

      try {
        setConnected(String(context.getCastState()) === "CONNECTED");
      } catch {}

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onStateChanged
      );
      context.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionStateChanged
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
          context.removeEventListener(
            window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            onSessionStateChanged
          );
        } catch {}
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [source, title, poster]);

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

      // The transparent Google launcher over the button normally handles this.
      // Keep requestSession as a fallback for browsers that omit the launcher.
      await context.requestSession();
    } catch (e: any) {
      const code = typeof e === "string" ? e : e?.code || e?.message;
      console.warn("[Cast] cast failed:", code);
      // "cancel" also fires when the picker had nothing to show — try the
      // browser's native remote playback picker before giving up.
      if (code === "cancel" || code === "receiver_unavailable") {
        await remotePrompt();
      }
    }
  }, [connected]);

  if (!ready && !castSupported) return null;


  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`relative z-30 h-9 overflow-hidden rounded-full px-3 text-[11px] font-bold backdrop-blur-md ${
        connected
          ? "bg-primary text-primary-foreground"
          : "bg-background/70 text-foreground hover:bg-background/90"
      }`}
      onClick={connected || !ready || window.self !== window.top ? handleCast : undefined}
      aria-label={connected ? "Stop casting" : "Cast to TV"}
      title={connected ? "Stop casting" : "Cast to TV"}
    >
      <Cast className="w-4 h-4" />

      {connected ? "Casting" : "Cast"}
      {/* Click surface. The Google launcher element is clipped to this badge so
          its default (very large) icon can never cover the video. */}
      <span className="absolute inset-0 overflow-hidden rounded-full">
        {ready && !connected && window.self === window.top ? (
          <google-cast-launcher
            aria-label="Cast to TV"
            title="Cast to TV"
            className="cast-launcher-overlay"
          />
        ) : (
          <span className="absolute inset-0 cursor-pointer" onClick={handleCast} />
        )}
      </span>
    </Button>
  );
}


export default CastButton;
