import { useState, useEffect, useCallback } from "react";
import { Play, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface SNYVideo {
  videoId: string;
  title: string;
  published: string;
  description: string;
  thumbnail: string;
}

interface HighlightsSectionProps {
  className?: string;
  /** If provided, called before opening a video. Return true to prevent the default dialog. */
  onVideoClick?: (video: SNYVideo) => boolean | void;
  /** Optional badge element rendered inline next to the title */
  badge?: React.ReactNode;
}

const CACHE_KEY = "sny_videos_cache_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const HighlightsSection = ({ className, onVideoClick, badge }: HighlightsSectionProps) => {
  const [videos, setVideos] = useState<SNYVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SNYVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  const loadFromCache = (): SNYVideo[] | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts: number; videos: SNYVideo[] };
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.videos;
    } catch {
      return null;
    }
  };

  const fetchHighlights = useCallback(async () => {
    const cached = loadFromCache();
    if (cached && cached.length > 0) {
      setVideos(cached);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("fetch-sny-videos");
      if (error) throw error;
      const list: SNYVideo[] = data?.videos ?? [];
      setVideos(list);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), videos: list }));
      } catch {
        /* ignore quota */
      }
    } catch (err) {
      console.error("Error fetching SNY videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('highlights-scroll');
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  if (loading || videos.length === 0) {
    return null;
  }

  return (
    <>
      <section className={cn("py-6 sm:py-8 relative", className)}>
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <img src={metsLogo} alt="MetsXM FanZone" className="w-4 h-4 sm:w-6 sm:h-6 object-contain shrink-0" />
              <div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <h2 className="text-xs sm:text-base md:text-lg font-bold text-foreground">
                    Mets Video Highlights
                  </h2>
                  {badge}
                </div>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground">
                  Powered by SNY
                </p>
              </div>
            </div>
            <a
              href="https://sny.tv/video"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] sm:text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
            >
              View All
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Netflix-style carousel container */}
        <div className="relative group/carousel">
          {scrollPosition > 0 && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            >
              <ChevronLeft className="w-8 h-8 text-foreground" />
            </button>
          )}

          <div
            id="highlights-scroll"
            onScroll={handleScroll}
            className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-6 lg:px-8"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />

            {videos.map((video) => (
              <div
                key={video.videoId}
                onClick={() => {
                  if (onVideoClick) {
                    const prevented = onVideoClick(video);
                    if (prevented) return;
                  }
                  setSelectedVideo(video);
                }}
                className="flex-shrink-0 w-[240px] sm:w-[280px] md:w-[320px] lg:w-[380px] cursor-pointer group"
              >
                <div className="relative overflow-hidden rounded-md sm:rounded-lg transition-all duration-300 group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-primary/20">
                  <div className="aspect-video relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { const t = e.currentTarget; if (!t.dataset.fbk) { t.dataset.fbk = "1"; t.src = "/placeholder.svg"; } }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-background to-transparent">
                    <p className="text-foreground text-xs sm:text-sm font-semibold line-clamp-2 group-hover:line-clamp-none transition-all">
                      {video.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex-shrink-0 w-0 lg:w-[calc((100vw-1280px)/2)]" />
          </div>

          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
          >
            <ChevronRight className="w-8 h-8 text-foreground" />
          </button>
        </div>
      </section>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 overflow-hidden glass-card border-border/30">
          {selectedVideo && (
            <div className="relative bg-background/90 w-full">
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <div className="p-3 sm:p-4">
                <h3 className="text-foreground text-sm sm:text-base font-bold">
                  {selectedVideo.title}
                </h3>
                {selectedVideo.description && (
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2 whitespace-pre-line">
                    {selectedVideo.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HighlightsSection;
