import { useState } from "react";
import { Cast, Tv } from "lucide-react";

interface ClapprPlayerProps {
  pageTitle?: string;
  pageDescription?: string;
  source?: string;
  showChrome?: boolean;
}

const DEFAULT_IFRAME_SRC =
  "https://video1.getstreamhosting.com:2000/VideoPlayer/resyweugpd?autoplay=1&mute=0&muted=0&volume=1";

// Convert an HLS .m3u8 URL into the hosted VideoPlayer iframe URL when possible.
// Example: https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8
//       -> https://video1.getstreamhosting.com:2000/VideoPlayer/resyweugpd?autoplay=1
function toIframeSrc(source?: string): string {
  if (!source) return DEFAULT_IFRAME_SRC;
  try {
    // If it's already an iframe/player URL, just use it.
    if (/\/VideoPlayer\//i.test(source)) return source;
    const u = new URL(source);
    const parts = u.pathname.split("/").filter(Boolean);
    const streamKey = parts[0];
    if (u.hostname.includes("getstreamhosting") && streamKey) {
      return `https://${u.hostname}:2000/VideoPlayer/${streamKey}?autoplay=1`;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_IFRAME_SRC;
}

export function ClapprPlayer({
  pageTitle = "Live Stream",
  pageDescription = "Watch live content",
  source,
  showChrome = true,
}: ClapprPlayerProps) {
  const [isCasting, setIsCasting] = useState(false);
  const iframeSrc = toIframeSrc(source);

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
          source || "",
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

  const playerEl = (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black"
      style={{ paddingTop: "56.25%" }}
    >
      <iframe
        key={iframeSrc}
        src={iframeSrc}
        title={pageTitle}
        referrerPolicy="origin"
        scrolling="no"
        frameBorder={0}
        allow="autoplay; fullscreen"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
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
