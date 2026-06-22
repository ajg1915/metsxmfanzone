import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X } from "lucide-react";

interface NewStory {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const resolveStoryAssetUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  const fileName = url.includes("/stories/") ? url.split("/stories/").pop() : url.replace(/^stories\//, "");
  if (!fileName) return null;
  return supabase.storage.from("stories").getPublicUrl(fileName).data.publicUrl;
};

/**
 * Floating banner that pops up on the live stream player
 * whenever an admin posts a new story/update to the MetsXMFanZone Feed.
 */
export function NewPostAlert() {
  const [story, setStory] = useState<NewStory | null>(null);
  const [visible, setVisible] = useState(false);
  const [fsEl, setFsEl] = useState<Element | null>(null);
  const latestMarkerRef = useRef<string | null>(null);

  const showStory = useCallback((row: any, force = false) => {
    if (!row || row.published === false) return;
    const marker = `${row.id}:${row.updated_at || row.created_at || ""}`;
    if (!force && latestMarkerRef.current === marker) return;
    latestMarkerRef.current = marker;
    setStory({
      id: row.id,
      title: row.title || "New update",
      thumbnail_url: row.thumbnail_url,
      media_url: row.media_url,
      media_type: row.media_type,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    const update = () =>
      setFsEl(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          null,
      );
    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchLatest = async (primeOnly = false) => {
      const { data, error } = await supabase
        .from("stories")
        .select("id,title,thumbnail_url,media_url,media_type,published,created_at,updated_at")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) return;
      const marker = `${data.id}:${data.updated_at || data.created_at || ""}`;
      if (primeOnly) {
        latestMarkerRef.current = marker;
        return;
      }
      if (latestMarkerRef.current !== marker) showStory(data);
    };

    fetchLatest(true);
    const poll = window.setInterval(() => fetchLatest(false), 12000);

    const handle = (payload: any) => showStory(payload.new as any, true);

    const channel = supabase
      .channel("stream-new-story-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories" },
        handle,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stories" },
        handle,
      )
      .subscribe((status) => {
        console.log("[NewPostAlert] realtime:", status);
      });

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [showStory]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(t);
  }, [visible, story?.id]);

  if (!visible || !story) return null;

  // Prefer explicit thumbnail (fanart), fall back to the media itself if it's an image
  const thumb =
    resolveStoryAssetUrl(story.thumbnail_url) ||
    (story.media_type !== "video" ? resolveStoryAssetUrl(story.media_url) : null);
  const isVideo = story.media_type === "video";

  const content = (
    <div
      className="pointer-events-none fixed bottom-4 left-3 sm:left-4 w-[min(88%,340px)] animate-slide-in-right"
      style={{ zIndex: 2147483647 }}
    >
      <a
        href="/#feed"
        onClick={() => setVisible(false)}
        className="pointer-events-auto group flex items-stretch gap-2 p-2 pr-8 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 shadow-2xl hover:bg-black/90 transition-colors relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-orange-500" />
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="eager"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
            className="ml-1 w-16 h-16 rounded object-cover flex-shrink-0 bg-white/5"
          />
        ) : isVideo && story.media_url ? (
          <video
            src={story.media_url}
            muted
            playsInline
            preload="metadata"
            className="ml-1 w-16 h-16 rounded object-cover flex-shrink-0 bg-white/5"
          />
        ) : (
          <div className="ml-1 w-16 h-16 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            New Feed Update
          </div>
          <p className="text-white text-sm font-semibold leading-tight line-clamp-2 mt-0.5">
            {story.title}
          </p>
          <p className="text-white/60 text-[10px] mt-0.5">Tap to view</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible(false);
          }}
          className="pointer-events-auto absolute top-1 right-1 p-1 rounded-full hover:bg-white/15 text-white/70 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </a>
    </div>
  );

  // When the browser is in real fullscreen, portal into the fullscreen element
  // so the alert paints on top. iOS Safari's native video fullscreen is an OS
  // layer that no DOM overlay can sit on top of — for that case we fall back to
  // fixed positioning which appears as soon as the user exits fullscreen.
  if (fsEl && typeof document !== "undefined") {
    return createPortal(content, fsEl as Element);
  }
  return content;

}

export default NewPostAlert;
