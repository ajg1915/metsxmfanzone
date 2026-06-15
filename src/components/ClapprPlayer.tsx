import { useEffect, useRef } from "react";
import Clappr from "@clappr/player";

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

  useEffect(() => {
    if (!containerRef.current || !source) return;
    const container = containerRef.current;

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
      autoPlay: false,
    });

    playerRef.current = player;

    return () => {
      try { player.destroy(); } catch {}
      playerRef.current = null;
      container.replaceChildren();
    };
  }, [source]);

  const playerEl = (
    <div
      id="clappr"
      className="relative w-full"
      style={{ minHeight: 320, height: "100%", marginBottom: 25 }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />
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
