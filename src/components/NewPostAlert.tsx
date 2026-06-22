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
    const channel = supabase
      .channel("stream-new-story-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories" },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          // Ignore drafts / unpublished
          if (row.published === false) return;
          setStory({
            id: row.id,
            title: row.title || "New update",
            thumbnail_url: row.thumbnail_url,
            media_url: row.media_url,
            media_type: row.media_type,
          });
          setVisible(true);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 12000);
    return () => clearTimeout(t);
  }, [visible, story?.id]);

  if (!visible || !story) return null;

  const thumb =
    story.media_type === "video" && story.thumbnail_url
      ? story.thumbnail_url
      : story.media_url;

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[min(94%,440px)] animate-fade-in">
      <Link
        to="/#feed"
        onClick={() => setVisible(false)}
        className="pointer-events-auto group flex items-center gap-3 p-2 pr-3 rounded-xl bg-gradient-to-r from-primary/90 via-primary/80 to-orange-500/80 backdrop-blur-md border border-white/20 shadow-2xl hover:scale-[1.02] transition-transform"
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-12 h-12 rounded-lg object-cover ring-2 ring-white/40 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            New Feed Update
          </div>
          <p className="text-white text-sm font-semibold truncate">
            {story.title}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible(false);
          }}
          className="pointer-events-auto p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </Link>
    </div>
  );
}

export default NewPostAlert;
