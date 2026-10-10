import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { TVHeroCarousel, type TVHeroSlide } from "@/components/tv/TVHeroCarousel";
import { TVTopBar } from "@/components/tv/TVTopBar";
import { TVSignIn } from "@/components/tv/TVSignIn";
import { TVContentRail } from "@/components/tv/TVContentRail";
import { setTVModePreference } from "@/hooks/use-device";
import { streamPath, NETWORK_STREAM } from "@/lib/tvNavigation";
import GamecastBanner from "@/components/GamecastBanner";
import { SHOW_METS_GAME_CENTER } from "@/config/season";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

export type TVCategory = "home" | "live" | "highlights" | "replays";

const TVDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();

  // Section refs for scrolling
  const storiesRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const highlightsRef = useRef<HTMLDivElement>(null);
  const replaysRef = useRef<HTMLDivElement>(null);

  const handleCategoryChange = useCallback((cat: TVCategory) => {
    const refMap: Record<TVCategory, React.RefObject<HTMLDivElement | null>> = {
      home: storiesRef,
      live: liveRef,
      highlights: highlightsRef,
      replays: replaysRef,
    };
    const ref = refMap[cat];
    if (cat === "home") {
      // Scroll to top
      document.querySelector("#tv-main")?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Each live stream opens its own page (ESPN, MSG, MLB Network...), not the Mets TV page.
  const openLive = useCallback((item: { id: string; title: string }) => navigate(streamPath(item.title, item.id)), [navigate]);
  const goToSpring = useCallback(() => navigate("/spring-training-live"), [navigate]);

  const { data: liveStreams = [], isLoading: streamsLoading } = useQuery({
    queryKey: ["tv-live-streams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .eq("published", true)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: highlights = [], isLoading: highlightsLoading } = useQuery({
    queryKey: ["tv-highlights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("published", true)
        .eq("video_type", "highlight")
        .order("published_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: replays = [], isLoading: replaysLoading } = useQuery({
    queryKey: ["tv-replays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("replay_games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: springGames = [], isLoading: springLoading } = useQuery({
    queryKey: ["tv-spring-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spring_training_games")
        .select("*")
        .eq("published", true)
        .order("game_date", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["tv-stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["tv-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image_url, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = streamsLoading || highlightsLoading || replaysLoading || springLoading || storiesLoading || articlesLoading;

  const liveItems = useMemo(() =>
    liveStreams.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnail: s.thumbnail_url || "/placeholder.svg",
      badge: s.status === "live" ? "LIVE" : s.status === "scheduled" ? "Upcoming" : undefined,
      subtitle: s.description?.slice(0, 80) || "",
      streamUrl: s.stream_url,
      isLive: s.status === "live",
    })),
    [liveStreams]
  );

  const highlightItems = useMemo(() =>
    highlights.map((v: any) => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnail_url || "/placeholder.svg",
      subtitle: v.description?.slice(0, 80) || "",
    })),
    [highlights]
  );

  const replayItems = useMemo(() =>
    replays.map((r) => ({
      id: r.id,
      title: r.title,
      thumbnail: r.thumbnail_url || "/placeholder.svg",
      subtitle: r.description?.slice(0, 80) || "",
    })),
    [replays]
  );

  const springItems = useMemo(() =>
    springGames.map((g) => ({
      id: g.id,
      title: `Mets ${g.is_home_game ? 'vs' : '@'} ${g.opponent}`,
      thumbnail: g.preview_image_url || "/placeholder.svg",
      subtitle: `${g.game_date} • ${g.game_time || 'TBD'} • ${g.location || ''}`,
      badge: g.game_status === 'live' ? "LIVE" : g.game_status === 'final' ? "Final" : undefined,
    })),
    [springGames]
  );

  const resolvedStories = useMemo(() =>
    stories.map((s) => {
      // Full URLs (R2 or external) are used as-is; only legacy bare file names resolve via storage.
      const resolveAsset = (value: string | null): string | null => {
        if (!value) return null;
        if (value.startsWith('http')) return value;
        const fileName = value.split('/stories/')[1] || value;
        const { data: urlData } = supabase.storage.from('stories').getPublicUrl(fileName);
        return urlData?.publicUrl || value;
      };
      const publicMediaUrl = resolveAsset(s.media_url);
      const thumbnailUrl = resolveAsset(s.thumbnail_url ?? null);
      return { ...s, media_url: publicMediaUrl, thumbnail_url: thumbnailUrl };
    }),
    [stories]
  );


  const storyItems = useMemo(() =>
    resolvedStories.map((s) => ({
      id: s.id,
      title: s.title,
      thumbnail: s.thumbnail_url || s.media_url || "/placeholder.svg",
      subtitle: s.media_type === 'video' ? 'Video Story' : 'Photo Story',
    })),
    [resolvedStories]
  );

  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<any>(null);
  const [selectedReplay, setSelectedReplay] = useState<any>(null);

  const handleStoryClick = useCallback((item: any) => {
    const story = resolvedStories.find((s) => s.id === item.id);
    if (story) setSelectedStory(story);
  }, [resolvedStories]);

  // Story viewer: left/right on the remote (or the on-screen arrows) moves between stories.
  const storyIdx = selectedStory ? resolvedStories.findIndex((s) => s.id === selectedStory.id) : -1;
  const stepStory = useCallback(
    (step: number) => {
      const next = resolvedStories[storyIdx + step];
      if (next) setSelectedStory(next);
    },
    [resolvedStories, storyIdx],
  );

  const handleHighlightClick = useCallback((item: any) => {
    const video = highlights.find((v: any) => v.id === item.id);
    if (video) setSelectedHighlight(video);
  }, [highlights]);

  const handleReplayClick = useCallback((item: any) => {
    const replay = replays.find((r) => r.id === item.id);
    if (replay) setSelectedReplay(replay);
  }, [replays]);

  // The hero always features MetsXMFanZone TV (our own channel, live around the clock), never a
  // network like SNY. Use its live stream's details when one is published.
  const heroStream = liveStreams.find((s) => s.status === "live" && streamPath(s.title, s.id) === "/metsxmfanzone");

  const articleItems = useMemo(() =>
    articles.map((a: any) => ({
      id: a.id,
      title: a.title,
      thumbnail: a.featured_image_url || "/placeholder.svg",
      subtitle: a.excerpt?.slice(0, 80) || "",
      slug: a.slug,
    })),
    [articles]
  );

  const heroSlides = useMemo<TVHeroSlide[]>(() => {
    const slides: TVHeroSlide[] = [];
    slides.push({
      id: "live-metsxmfanzone-tv",
      kind: "live",
      badge: "Live now",
      title: "MetsXMFanZone TV",
      description: heroStream?.description || "Live coverage, Game Day Live and the podcast, on your TV.",
      image: heroStream?.thumbnail_url,
      primaryLabel: "Watch live",
      to: "/metsxmfanzone",
    });
    articles.slice(0, 3).forEach((a: any) => {
      slides.push({
        id: `article-${a.id}`,
        kind: "article",
        badge: "Article",
        title: a.title,
        description: a.excerpt || "",
        image: a.featured_image_url,
        primaryLabel: "Read article",
        to: `/blog/${a.slug}`,
      });
    });
    return slides;
  }, [heroStream, articles]);

  // Loading state
  if (authLoading || subLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-center">
          <img src={metsLogo} alt="MetsXMFanZone" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading TV Mode...</p>
        </div>
      </div>
    );
  }

  // Not signed in: show the TV sign-in so a member can log in with the remote
  if (!user) {
    return <TVSignIn />;
  }

  // Signed in but not a paid member: TV Mode is for paid plans only
  if (!isPremium) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-[#07101f] text-[#f2f5fa]">
        <div className="mx-auto flex min-h-full max-w-[44rem] flex-col justify-center px-8 py-6 text-center">
          <img src={metsLogo} alt="MetsXMFanZone" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-[2.4rem] font-bold mb-4">TV Mode is for paid members</h1>
          <p className="text-[1.35rem] text-[#9fb0c9] mb-8">
            Join a plan on your phone or computer at metsxmfanzone.com/pricing, then come back and
            this screen will open.
          </p>
          <div className="flex flex-col gap-4 items-center">
            <Button
              onClick={() => navigate("/pricing")}
              className="gap-3 rounded-full bg-white text-[#07101f] hover:bg-white/90 text-[1.3rem] font-bold px-10 py-7"
            >
              <Crown className="w-6 h-6" />
              View plans
            </Button>
            <Button
              variant="ghost"
              onClick={() => void signOut()}
              className="rounded-full bg-[#17263f] text-[#f2f5fa] text-[1.15rem] px-8 py-6"
            >
              Sign out
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTVModePreference(false);
                navigate("/");
                window.location.reload();
              }}
              className="rounded-full bg-[#17263f] text-[#f2f5fa] text-[1.15rem] px-8 py-6"
            >
              Leave TV Mode
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#07101f] text-[#f2f5fa] flex flex-col">
      <SEOHead
        title="TV Dashboard | MetsXMFanZone"
        description="Amazon TV-style dashboard for MetsXMFanZone streaming content."
        keywords="Mets TV, streaming, live games"
      />

      <TVTopBar onHome={() => handleCategoryChange("home")} />

      <main id="tv-main" className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="space-y-6 px-6 py-4">
            <Skeleton className="h-[220px] w-full rounded-lg bg-muted" />
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32 bg-muted" />
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-28 w-48 shrink-0 rounded-md bg-muted" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="px-[2.4vw] pt-[3vh]">
              <TVHeroCarousel slides={heroSlides} />
            </div>
            <div className="px-[2.4vw] pb-[6vh]">
              {/* Gamecast Banner */}
              {SHOW_METS_GAME_CENTER && <GamecastBanner />}

              {/* Stories */}
              <div ref={storiesRef}>
                {storyItems.length > 0 && <TVContentRail title="Stories" items={storyItems} onItemClick={handleStoryClick} />}
              </div>

              {/* Live section */}
              <div ref={liveRef}>
                {liveItems.filter((i) => !NETWORK_STREAM.test(i.title)).length > 0 && (
                  <TVContentRail title="Live Now" items={liveItems.filter((i) => !NETWORK_STREAM.test(i.title))} accent onItemClick={openLive} />
                )}
                {liveItems.filter((i) => NETWORK_STREAM.test(i.title)).length > 0 && (
                  <TVContentRail title="Sports Networks" items={liveItems.filter((i) => NETWORK_STREAM.test(i.title))} onItemClick={openLive} />
                )}
              </div>

              {/* News */}
              {articleItems.length > 0 && (
                <TVContentRail
                  title="From the news"
                  items={articleItems}
                  onItemClick={(item: any) => navigate(`/blog/${item.slug}`)}
                />
              )}

              {/* Spring Training */}
              {springItems.length > 0 && <TVContentRail title="Spring Training" items={springItems} onItemClick={goToSpring} />}

              {/* Highlights section */}
              <div ref={highlightsRef}>
                {highlightItems.length > 0 && <TVContentRail title="Video Highlights" items={highlightItems} onItemClick={handleHighlightClick} />}
              </div>

              {/* Replays section */}
              <div ref={replaysRef}>
                {replayItems.length > 0 && <TVContentRail title="Game Replays" items={replayItems} onItemClick={handleReplayClick} />}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Story Viewer Dialog */}
      <Dialog open={!!selectedStory} onOpenChange={(open) => !open && setSelectedStory(null)}>
        <DialogContent
          className="w-[min(92vw,1100px)] max-w-none p-0 bg-card border-border overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); stepStory(1); }
            if (e.key === "ArrowLeft") { e.preventDefault(); stepStory(-1); }
          }}
        >
          {selectedStory && (
            <div className="flex flex-col">
              <div className="relative">
                {selectedStory.media_type === "video" ? (
                  <video
                    key={selectedStory.id}
                    src={selectedStory.media_url}
                    controls
                    autoPlay
                    className="w-full aspect-video max-h-[70dvh] object-contain bg-black"
                  />
                ) : (
                  <img
                    src={selectedStory.media_url}
                    alt={selectedStory.title}
                    className="w-full aspect-video max-h-[70dvh] object-contain bg-black"
                  />
                )}
                {storyIdx > 0 && (
                  <button type="button" onClick={() => stepStory(-1)} aria-label="Previous story" className="absolute left-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:scale-110 focus:scale-110">
                    <ChevronLeft className="h-9 w-9" />
                  </button>
                )}
                {storyIdx < resolvedStories.length - 1 && (
                  <button type="button" onClick={() => stepStory(1)} aria-label="Next story" className="absolute right-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:scale-110 focus:scale-110">
                    <ChevronRight className="h-9 w-9" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <h3 className="text-foreground font-semibold text-[1.4rem] truncate">{selectedStory.title}</h3>
                  <p className="text-muted-foreground text-[1rem] mt-1">
                    Story {storyIdx + 1} of {resolvedStories.length} · {selectedStory.media_type === "video" ? "Video" : "Photo"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-[1rem] text-[#cfd8e6]">◀ ▶ Left / right for more · Back to close</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Highlight Video Player Dialog */}
      <Dialog open={!!selectedHighlight} onOpenChange={(open) => !open && setSelectedHighlight(null)}>
        <DialogContent className="max-w-2xl p-0 bg-card border-border overflow-hidden">
          {selectedHighlight && (
            <div className="flex flex-col">
              <video
                src={selectedHighlight.video_url}
                controls
                autoPlay
                className="w-full aspect-video object-contain bg-black"
              />
              <div className="p-4">
                <h3 className="text-foreground font-semibold text-sm">{selectedHighlight.title}</h3>
                {selectedHighlight.description && (
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{selectedHighlight.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Replay Player Dialog */}
      <Dialog open={!!selectedReplay} onOpenChange={(open) => !open && setSelectedReplay(null)}>
        <DialogContent className="max-w-2xl p-0 bg-card border-border overflow-hidden">
          {selectedReplay && (
            <div className="flex flex-col">
              <iframe
                src={selectedReplay.embed_url}
                title={selectedReplay.title}
                className="w-full aspect-video bg-black"
                allowFullScreen
              />
              <div className="p-4">
                <h3 className="text-foreground font-semibold text-sm">{selectedReplay.title}</h3>
                {selectedReplay.description && (
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{selectedReplay.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TVDashboard;
