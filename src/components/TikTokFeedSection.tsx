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
                className="group relative block rounded-xl overflow-hidden bg-card/90 backdrop-blur border border-border transition-all duration-500 ease-out hover:border-primary hover:-translate-y-1 hover:shadow-[0_20px_40px_-12px_hsl(var(--primary)/0.45)] hover:ring-2 hover:ring-primary/40"
              >
                <div className="aspect-[3/4] relative bg-muted overflow-hidden">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#ff0050]/30 to-[#00f2ea]/30 transition-transform duration-700 group-hover:scale-110">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                  )}
                  {/* Shine sweep */}
                  <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  {/* Darken + reveal overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent transition-opacity duration-300 group-hover:from-black/90" />
                  {/* Play button reveal */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:scale-100">
                    <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                      <Play className="w-6 h-6 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-[10px] font-bold transition-transform duration-300 group-hover:scale-110">
                    <Play className="w-3 h-3 fill-white" />
                    TikTok
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 transition-transform duration-300 group-hover:-translate-y-1">
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
