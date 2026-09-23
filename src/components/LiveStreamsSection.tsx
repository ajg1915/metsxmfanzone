import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFreeTrialConfig } from "@/hooks/useFreeTrial";
import { useFreeStreams } from "@/hooks/useFreeStreams";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, Play, ChevronRight, ChevronLeft, ShieldCheck, GripVertical, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import PremiumBadge from "@/components/PremiumBadge";
import fanartGeneral from "@/assets/fanart-mets-general.jpg";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LiveStream {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string;
  viewers_count: number;
  assigned_pages: string[];
  display_order: number;
}

const SortableStreamCard = ({
  stream,
  isAdmin,
  adminMode,
  tier,
  onStreamClick,
  onToggleLive,
  isSpringTraining,
  isProStream,
  guestPreview = false,
}: {
  stream: LiveStream;
  isAdmin: boolean;
  adminMode: boolean;
  tier: string;
  onStreamClick: (s: LiveStream) => void;
  onToggleLive: (id: string, currentStatus: string) => void;
  isSpringTraining: boolean;
  isProStream: boolean;
  guestPreview?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stream.id, disabled: !adminMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="min-w-0 w-full sm:flex-shrink-0 sm:w-[280px] md:w-[320px] lg:w-[380px] cursor-pointer group relative"
    >
      {adminMode && (
        <div
          {...attributes}
          {...listeners}
          style={{ touchAction: "none" }}
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground rounded-full p-2 shadow-lg cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      <div
        onClick={() => !adminMode && onStreamClick(stream)}
        className={cn(
          "relative overflow-hidden rounded-md sm:rounded-lg transition-all duration-300",
          !adminMode && "group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-primary/20",
          isDragging && "ring-2 ring-primary"
        )}
      >
        <div className="aspect-video relative">
          {stream.thumbnail_url ? (
            <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" onError={(e) => { if (e.currentTarget.src !== fanartGeneral) e.currentTarget.src = fanartGeneral; }} />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {!adminMode && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ml-0.5" fill="currentColor" />
              </div>
            </div>
          )}

          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {guestPreview ? (
              <Badge className="text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-green-600/90 text-white">
                FREE PREVIEW
              </Badge>
            ) : (
              isProStream && !isAdmin && tier !== "weekly" && tier !== "premium" && tier !== "annual" && (
                <PremiumBadge size="sm" />
              )
            )}
            {isSpringTraining && !isAdmin && tier !== "weekly" && tier !== "premium" && tier !== "annual" && (
              <Badge className="text-[10px] px-1.5 py-0.5 font-semibold backdrop-blur-sm bg-green-600/90 text-white">
                FREE
              </Badge>
            )}
            <Badge className={cn(
              "text-[10px] sm:text-xs px-1.5 py-0.5 font-semibold backdrop-blur-sm",
              stream.status === 'live'
                ? 'bg-red-600/90 text-white shadow-lg shadow-red-600/50'
                : 'bg-secondary/80 text-secondary-foreground'
            )}>
              {stream.status === 'live' && <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" />}
              {stream.status === 'live' ? 'LIVE' : stream.status === 'scheduled' ? 'UPCOMING' : 'ENDED'}
            </Badge>
          </div>

          {!adminMode && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600/80 backdrop-blur-sm">
              <ShieldCheck className="w-2.5 h-2.5 text-white" />
              <span className="text-[8px] font-semibold text-white uppercase tracking-wide">VPN Secured</span>
            </div>
          )}

          {stream.viewers_count > 0 && !adminMode && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/90 backdrop-blur-sm text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
              <Users className="w-3 h-3 text-primary" />
              {stream.viewers_count}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-background to-transparent">
          <p className="text-foreground text-xs sm:text-sm font-semibold line-clamp-2">
            {stream.title}
          </p>
        </div>
      </div>

      {/* Admin: Set Live toggle below card */}
      {adminMode && (
        <div className="mt-2 flex items-center justify-between bg-card/80 backdrop-blur-sm rounded-md px-3 py-2 border border-border">
          <span className="text-xs font-medium text-muted-foreground">
            {stream.status === 'live' ? '🔴 Live' : '⏸ Not Live'}
          </span>
          <Switch
            checked={stream.status === 'live'}
            onCheckedChange={() => onToggleLive(stream.id, stream.status)}
            className="scale-90"
          />
        </div>
      )}
    </div>
  );
};

const LiveStreamsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier, isAdmin, loading: subscriptionLoading } = useSubscription();
  const { config: trialConfig } = useFreeTrialConfig();
  const { isFree } = useFreeStreams();
  const guestPreviewOn = !user && trialConfig.guestPreviewEnabled !== false;
  const isGuestPreviewStream = (s: LiveStream) =>
    guestPreviewOn && !isFree(s.id) && !s.assigned_pages?.includes("metsxmfanzone");
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [adminMode, setAdminMode] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // Auto-check stream statuses based on scheduled times
  const runAutoStatusCheck = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      let changed = false;

      const { data: toGoLive } = await supabase
        .from("live_streams")
        .select("id, title")
        .eq("status", "scheduled")
        .eq("published", true)
        .lte("scheduled_start", now)
        .not("scheduled_start", "is", null);

      if (toGoLive && toGoLive.length > 0) {
        for (const stream of toGoLive) {
          await supabase
            .from("live_streams")
            .update({ status: "live", actual_start: now })
            .eq("id", stream.id);
        }
        changed = true;
      }

      const { data: toEnd } = await supabase
        .from("live_streams")
        .select("id")
        .eq("status", "live")
        .lte("scheduled_end", now)
        .not("scheduled_end", "is", null);

      if (toEnd && toEnd.length > 0) {
        for (const stream of toEnd) {
          await supabase
            .from("live_streams")
            .update({ status: "ended", actual_end: now })
            .eq("id", stream.id);
        }
        changed = true;
      }

      if (changed) fetchStreams();
    } catch (err) {
      console.error("Auto status check error:", err);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    runAutoStatusCheck();

    // Check every 60 seconds
    const interval = setInterval(runAutoStatusCheck, 60000);

    const channel = supabase.channel('live-streams-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_streams'
    }, () => {
      if (!adminMode) fetchStreams();
    }).subscribe();

    return () => { 
      clearInterval(interval);
      supabase.removeChannel(channel); 
    };
  }, [adminMode, user, isAdmin]);

  const fetchStreams = async () => {
    try {
      // The homepage only needs public display metadata. Always use the safe
      // view so signed-in members and guests see the exact same Live Now row;
      // playback URLs remain available only on the protected player pages.
      let query = (supabase as any)
        .from("live_streams_public")
        .select("*")
        .eq("published", true)
        .order("scheduled_start", { ascending: true, nullsFirst: false })
        .limit(100);

      // The public homepage always loads the live-only feed. Admins fetch the
      // full catalog only after explicitly opening edit mode; otherwise the
      // first 100 historical games can overwrite today's live cards.
      if (!(isAdmin && adminMode)) {
        query = query.eq("status", "live");
      }

      const { data, error } = await query;
      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        // Live streams always come first
        const aLive = a.status === 'live' ? 0 : 1;
        const bLive = b.status === 'live' ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        // Then by scheduled_start date ascending
        const aDate = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
        const bDate = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
        if (aDate !== bDate) return aDate - bDate;
        // Finally by created_at descending
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });


      // Live Streams shows only games you add, plus MetsXMFanZone live and
      // event broadcasts. Always-on 24/7 network channel feeds never appear
      // here — exclusions are checked BEFORE the game/event title match so a
      // 24/7 feed can never slip back in through its title wording.
      const networkChannelPages = ['mlb-network', 'sny-tv', 'sny.tv', 'msg-network', 'msg', 'espn-network', 'espn', 'pix11-network', 'pix11'];
      const looksLike247 = (s: { title: string; description?: string | null }) => {
        const text = `${s.title} ${s.description || ''}`.toLowerCase();
        return text.includes('24/7') || text.includes('24-7') || text.includes('24x7');
      };
      const isGameBroadcast = (title: string) =>
        /\b(vs\.?|@|at)\b/i.test(title) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(title);

      const filtered = sorted.filter(s => {
        // 1. Always-on 24/7 channel feeds never belong in Live Streams.
        if (looksLike247(s)) return false;

        const pages = (s.assigned_pages || [])
          .map(p => p.toLowerCase())
          .filter(p => p !== 'live' && p !== 'guide');

        // 2. Entries that only feed a network channel page stay in Sports
        //    Network Streams.
        if (pages.length > 0 && pages.every(p => networkChannelPages.includes(p))) return false;

        // 3. Games and dated events always belong here.
        if (isGameBroadcast(s.title)) return true;

        // 4. MetsXMFanZone live and event broadcasts belong here.
        if (pages.includes('metsxmfanzone') || pages.includes('metsxmfanzone-2')) return true;

        // 5. Admin-added entries with no channel page are homepage events.
        if (pages.length === 0) return true;

        return false;
      });
      setStreams(filtered as LiveStream[]);

    } catch (error) {
      console.error("Error fetching streams:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSpringTrainingStream = (_stream: LiveStream) => false;

  const isProStream = (_stream: LiveStream) => true;

  const getStreamPageUrl = (stream: LiveStream) => {
    // Games marked free for everyone always use their own watch page,
    // which is not gated behind sign in.
    if (isFree(stream.id)) return `/live/${stream.id}`;
    const networkPages = (stream.assigned_pages || []).filter(page => page !== 'live' && page !== 'guide');
    if (networkPages.includes('metsxmfanzone')) return '/metsxmfanzone';
    if (networkPages.includes('metsxmfanzone-2')) return '/live/metsxmfanzone-2';
    if (networkPages.includes('pix11-network')) return '/pix11-network';
    if (networkPages.includes('mlb-network')) return '/mlb-network';
    if (networkPages.includes('espn-network')) return '/espn-network';
    return `/live/${stream.id}`;
  };



  const handleStreamClick = (stream: LiveStream) => {
    if (subscriptionLoading) {
      navigate(getStreamPageUrl(stream));
      return;
    }

    if (isFree(stream.id)) {
      navigate(getStreamPageUrl(stream));
      return;
    }

    if (stream.assigned_pages?.includes('metsxmfanzone')) {
      if (!user) navigate("/auth");
      else navigate(getStreamPageUrl(stream));
      return;
    }
    if (isAdmin || tier === "weekly" || tier === "premium" || tier === "annual" || isGuestPreviewStream(stream)) {
      navigate(getStreamPageUrl(stream));
    } else {
      navigate("/pricing");
    }
  };

  const handleToggleLive = async (streamId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'live' ? 'scheduled' : 'live';
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'live') {
      updateData.actual_start = now;
      updateData.actual_end = null;
    } else {
      updateData.actual_end = now;
    }

    const { error } = await supabase
      .from('live_streams')
      .update(updateData)
      .eq('id', streamId);

    if (error) {
      toast.error("Failed to update stream status");
      return;
    }

    setStreams(prev => prev.map(s =>
      s.id === streamId ? { ...s, status: newStatus as LiveStream['status'] } : s
    ));
    toast.success(`Stream ${newStatus === 'live' ? 'set to LIVE' : 'taken off air'}`);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = streams.findIndex(s => s.id === active.id);
    const newIndex = streams.findIndex(s => s.id === over.id);
    const reordered = arrayMove(streams, oldIndex, newIndex);

    setStreams(reordered);

    let hasError = false;
    for (let i = 0; i < reordered.length; i++) {
      const { error } = await supabase
        .from('live_streams')
        .update({ display_order: i })
        .eq('id', reordered[i].id);
      if (error) {
        console.error(`Failed to update order for ${reordered[i].id}:`, error);
        hasError = true;
      }
    }

    if (hasError) {
      toast.error("Some order changes failed to save — refreshing");
      await fetchStreams();
    } else {
      toast.success("Stream order saved & published");
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('streams-scroll');
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

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading live streams...</div>
        </div>
      </section>
    );
  }

  // Non-admins: hide if no streams
  const visibleStreams = isAdmin && adminMode
    ? streams
    : streams.filter(s => s.status === 'live');
  if (visibleStreams.length === 0 && !isAdmin) return null;

  return (
    <>
      <UpgradePrompt open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
      <section className="py-6 sm:py-8 relative">
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Radio className="w-4 h-4 sm:w-6 sm:h-6 text-red-500 animate-pulse" />
              <h2 className="text-sm sm:text-xl md:text-2xl font-bold text-foreground">
                Live Streams
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setAdminMode(!adminMode)}
                  className={cn(
                    "ml-2 p-1.5 rounded-md transition-colors",
                    adminMode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  title={adminMode ? "Exit edit mode" : "Rearrange & manage streams"}
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <a
              href="/community"
              className="flex items-center gap-1 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              In Game Post
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          {adminMode && (
            <p className="text-xs text-muted-foreground mb-3">
              Drag to reorder • Toggle switch to set live/offline • Changes save automatically
            </p>
          )}
        </div>

        <div className="relative group/carousel">
          {scrollPosition > 0 && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
            >
              <ChevronLeft className="w-8 h-8 text-foreground" />
            </button>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleStreams.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              <div
                id="streams-scroll"
                onScroll={handleScroll}
                className="grid grid-cols-2 gap-2 px-3 sm:flex sm:gap-3 sm:overflow-x-auto sm:scroll-smooth sm:px-6 lg:px-8 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="hidden lg:block flex-shrink-0 w-[calc((100vw-1280px)/2)]" />

                {visibleStreams.map((stream) => (
                  <SortableStreamCard
                    key={stream.id}
                    stream={stream}
                    isAdmin={isAdmin}
                    adminMode={adminMode}
                    tier={tier}
                    onStreamClick={handleStreamClick}
                    onToggleLive={handleToggleLive}
                    isSpringTraining={isSpringTrainingStream(stream)}
                    isProStream={isProStream(stream)}
                    guestPreview={isGuestPreviewStream(stream)}
                  />
                ))}

                <div className="hidden lg:block flex-shrink-0 w-[calc((100vw-1280px)/2)]" />
              </div>
            </SortableContext>
          </DndContext>

          <button
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
          >
            <ChevronRight className="w-8 h-8 text-foreground" />
          </button>
        </div>

        {visibleStreams.length === 0 && isAdmin && adminMode && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No published streams found. Add streams in the Live Stream Management page.
          </div>
        )}
      </section>
    </>
  );
};

export default LiveStreamsSection;
