import { useState, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/SEOHead";
import { TVHeroBanner } from "@/components/tv/TVHeroBanner";
import { TVNavBar } from "@/components/tv/TVNavBar";
import { TVContentRail } from "@/components/tv/TVContentRail";
import GamecastBanner from "@/components/GamecastBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

export type TVCategory = "home" | "live" | "highlights" | "replays";

const TVDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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

  const goToMetsTV = useCallback(() => navigate("/metsxmfanzone"), [navigate]);
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

  const isLoading = streamsLoading || highlightsLoading || replaysLoading || springLoading || storiesLoading;

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

  const handleHighlightClick = useCallback((item: any) => {
    const video = highlights.find((v: any) => v.id === item.id);
    if (video) setSelectedHighlight(video);
  }, [highlights]);

  const handleReplayClick = useCallback((item: any) => {
    const replay = replays.find((r) => r.id === item.id);
    if (replay) setSelectedReplay(replay);
  }, [replays]);

  const heroStream = liveStreams.find((s) => s.status === "live") || liveStreams[0];

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

  // Premium gate - only paid members get TV mode
  if (!user || !isPremium) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-center max-w-md px-6">
          <img src={metsLogo} alt="MetsXMFanZone" className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-3">TV Mode is for Premium Members</h1>
          <p className="text-muted-foreground mb-6">
            Upgrade to Premium or Annual to unlock the full TV experience with live streams, highlights, replays, and more.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/pricing")}
              className="w-full gap-2 bg-primary hover:bg-primary/90"
            >
              <Crown className="w-4 h-4" />
              View Plans
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full border-mets-blue text-mets-blue hover:bg-mets-blue/10"
            >
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[hsl(var(--background))] flex flex-col">
      <SEOHead
        title="TV Dashboard | MetsXMFanZone"
        description="Amazon TV-style dashboard for MetsXMFanZone streaming content."
        keywords="Mets TV, streaming, live games"
      />

      <TVNavBar activeCategory="home" onCategoryChange={handleCategoryChange} />

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
            {heroStream && (
              <TVHeroBanner
                title={heroStream.title}
                description={heroStream.description || ""}
                thumbnail={heroStream.thumbnail_url || "/placeholder.svg"}
                streamUrl={heroStream.stream_url}
                isLive={heroStream.status === "live"}
              />
            )}
            <div className="space-y-1 px-6 pb-6 -mt-8 relative z-10">
              {/* Gamecast Banner */}
              <GamecastBanner />

              {/* Stories */}
              <div ref={storiesRef}>
                {storyItems.length > 0 && <TVContentRail title="Stories" items={storyItems} onItemClick={handleStoryClick} />}
              </div>

              {/* Live section */}
              <div ref={liveRef}>
                {liveItems.length > 0 && <TVContentRail title="Live Now" items={liveItems} accent onItemClick={goToMetsTV} />}
              </div>

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
        <DialogContent className="max-w-lg p-0 bg-card border-border overflow-hidden">
          <button
            onClick={() => setSelectedStory(null)}
            className="absolute top-3 right-3 z-50 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          {selectedStory && (
            <div className="flex flex-col">
              {selectedStory.media_type === "video" ? (
                <video
                  src={selectedStory.media_url}
                  controls
                  autoPlay
                  className="w-full aspect-video object-contain bg-black"
                />
              ) : (
                <img
                  src={selectedStory.media_url}
                  alt={selectedStory.title}
                  className="w-full aspect-video object-contain bg-black"
                />
              )}
              <div className="p-4">
                <h3 className="text-foreground font-semibold text-sm">{selectedStory.title}</h3>
                <p className="text-muted-foreground text-xs mt-1">
                  {selectedStory.media_type === "video" ? "Video Story" : "Photo Story"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Highlight Video Player Dialog */}
      <Dialog open={!!selectedHighlight} onOpenChange={(open) => !open && setSelectedHighlight(null)}>
        <DialogContent className="max-w-2xl p-0 bg-card border-border overflow-hidden">
          <button
            onClick={() => setSelectedHighlight(null)}
            className="absolute top-3 right-3 z-50 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
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
          <button
            onClick={() => setSelectedReplay(null)}
            className="absolute top-3 right-3 z-50 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
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
