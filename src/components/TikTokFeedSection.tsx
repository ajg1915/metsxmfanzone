import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, ExternalLink } from "lucide-react";

interface TikTokItem {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  publishedAt: string | null;
}

const USERNAME = "onbmedia";
const PROFILE_URL = `https://www.tiktok.com/@${USERNAME}`;

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const TikTokFeedSection = () => {
  const [items, setItems] = useState<TikTokItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("fetch-tiktok-feed");
        if (mounted && data?.items) setItems(data.items);
      } catch (_) {
        /* silent */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section className="py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Latest posts from <span className="text-primary">@{USERNAME}</span>
          </h2>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff0050] to-[#00f2ea] text-white text-sm font-semibold hover:opacity-90 transition shadow-md"
          >
            Follow on TikTok
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl bg-card/90 backdrop-blur border border-border p-8 text-center hover:border-primary transition"
          >
            <p className="text-muted-foreground mb-2">Visit @{USERNAME} on TikTok to see the latest posts</p>
            <span className="text-primary font-semibold">Open TikTok →</span>
          </a>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {items.slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block rounded-xl overflow-hidden bg-card/90 backdrop-blur border border-border hover:border-primary transition"
              >
                <div className="aspect-[3/4] relative bg-muted">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#ff0050]/30 to-[#00f2ea]/30">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold">
                    <Play className="w-3 h-3 fill-white" />
                    TikTok
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs md:text-sm font-medium line-clamp-2 mb-1">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-white/80 text-[10px]">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#ff0050] to-[#00f2ea]" />
                      <span className="font-semibold">@{USERNAME}</span>
                      <span>·</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TikTokFeedSection;
