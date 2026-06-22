import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

interface NewStory {
  id: string;
  title: string;
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

/**
 * Floating banner that pops up on the live stream player
 * whenever an admin posts a new story/update to the MetsXMFanZone Feed.
 */
export function NewPostAlert() {
  const [story, setStory] = useState<NewStory | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handle = (payload: any) => {
      const row = payload.new as any;
      if (!row) return;
      if (row.published === false) return;
      setStory({
        id: row.id,
        title: row.title || "New update",
        thumbnail_url: row.thumbnail_url,
        media_url: row.media_url,
        media_type: row.media_type,
      });
      setVisible(true);
    };

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
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(t);
  }, [visible, story?.id]);

  if (!visible || !story) return null;

  const thumb =
    story.media_type === "video" && story.thumbnail_url
      ? story.thumbnail_url
      : story.media_url;

  return (
    <div className="pointer-events-none absolute bottom-16 left-3 sm:left-4 z-30 w-[min(88%,340px)] animate-slide-in-right">
      <Link
        to="/#feed"
        onClick={() => setVisible(false)}
        className="pointer-events-auto group flex items-stretch gap-2 p-2 pr-8 rounded-lg bg-black/85 backdrop-blur-md border border-white/15 shadow-2xl hover:bg-black/90 transition-colors relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-orange-500" />
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="ml-1 w-16 h-16 rounded object-cover flex-shrink-0"
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
      </Link>
    </div>
  );
}

export default NewPostAlert;
