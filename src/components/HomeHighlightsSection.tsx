import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Film, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import fanartGeneral from "@/assets/fanart-mets-general.jpg";

// MetsXMFanZone Highlights: a row of the latest game highlight videos on the member home page.
const HomeHighlightsSection = () => {
  const navigate = useNavigate();
  const { data: videos = [] } = useQuery({
    queryKey: ["home-highlights"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, description, thumbnail_url")
        .eq("published", true)
        .eq("video_type", "highlight")
        .order("published_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (videos.length === 0) return null;

  return (
    <section className="relative py-6 sm:py-8" aria-labelledby="home-highlights-title">
      <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Film className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            <h2
              id="home-highlights-title"
              className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-2xl md:text-3xl"
            >
              MetsXMFanZone Highlights
            </h2>
          </div>
          <a
            href="/video-gallery"
            className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            See all
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div
        className="scrollbar-hide -mx-0 flex gap-3 overflow-x-auto px-4 pb-4 sm:px-6 md:gap-4 lg:px-8 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {videos.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => navigate("/video-gallery")}
            className="group relative w-[calc(100vw-4.5rem)] max-w-[340px] flex-shrink-0 snap-start text-left md:w-[320px] md:max-w-none lg:w-[380px]"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border/50 transition-all duration-300 group-hover:border-primary/50">
              <img
                src={v.thumbnail_url || fanartGeneral}
                alt={v.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  if (e.currentTarget.src !== fanartGeneral) e.currentTarget.src = fanartGeneral;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-70" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 shadow-lg backdrop-blur-sm">
                  <Play className="ml-0.5 h-5 w-5 fill-current text-primary-foreground" />
                </span>
              </div>
            </div>
            <h3 className="mt-2 line-clamp-1 text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary md:text-sm">
              {v.title}
            </h3>
          </button>
        ))}
      </div>
    </section>
  );
};

export default HomeHighlightsSection;
