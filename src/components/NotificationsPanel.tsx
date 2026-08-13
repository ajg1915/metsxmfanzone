import { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bell, Tv, FileText, MessageSquare, Trophy, Newspaper, Dot, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type NotificationItem = {
  id: string;
  type: "live" | "game_alert" | "story" | "blog" | "post";
  title: string;
  message: string;
  time: string;
  link?: string;
  isNew: boolean;
};

const typeConfig = {
  live: { icon: Tv, label: "Live Now", color: "text-red-500" },
  game_alert: { icon: Trophy, label: "Game Alert", color: "text-amber-500" },
  story: { icon: MessageSquare, label: "New Story", color: "text-blue-500" },
  blog: { icon: Newspaper, label: "New Article", color: "text-emerald-500" },
  post: { icon: FileText, label: "New Post", color: "text-purple-500" },
};

// Baseball bat crack notification sound using Web Audio API
const playBaseballSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Crack/hit sound
    const hit = ctx.createOscillator();
    const hitGain = ctx.createGain();
    hit.type = "square";
    hit.frequency.setValueAtTime(800, ctx.currentTime);
    hit.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    hitGain.gain.setValueAtTime(0.3, ctx.currentTime);
    hitGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    hit.connect(hitGain).connect(ctx.destination);
    hit.start(ctx.currentTime);
    hit.stop(ctx.currentTime + 0.15);

    // Bright "ding" after crack
    const ding = ctx.createOscillator();
    const dingGain = ctx.createGain();
    ding.type = "sine";
    ding.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
    ding.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
    dingGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.05);
    dingGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    ding.connect(dingGain).connect(ctx.destination);
    ding.start(ctx.currentTime + 0.05);
    ding.stop(ctx.currentTime + 0.4);

    setTimeout(() => ctx.close(), 500);
  } catch (e) {
    // Audio not supported, silently fail
  }
};

const getDismissedIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("dismissedNotifications") || "[]");
  } catch { return []; }
};

const saveDismissedIds = (ids: string[]) => {
  localStorage.setItem("dismissedNotifications", JSON.stringify(ids));
};

const NotificationsPanel = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedIds);
  const prevCountRef = useRef(0);
  const hasInteracted = useRef(false);

  // Track user interaction for autoplay policy
  useEffect(() => {
    const handler = () => { hasInteracted.current = true; };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("notificationsLastSeen");
    setLastSeen(stored);
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60s for new notifications
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const visible = notifications.filter(n => !dismissedIds.includes(n.id));
    const count = !lastSeen
      ? visible.length
      : visible.filter(n => new Date(n.time) > new Date(lastSeen)).length;
    
    // Play sound if count increased
    if (count > prevCountRef.current && prevCountRef.current > 0 && hasInteracted.current) {
      playBaseballSound();
    }
    prevCountRef.current = count;
    setUnreadCount(count);
  }, [notifications, lastSeen, dismissedIds]);

  const fetchNotifications = async () => {
    const items: NotificationItem[] = [];
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString();

    const [liveStreams, gameAlerts, stories, blogPosts] = await Promise.all([
      supabase
        .from("live_streams")
        .select("id, title, status, updated_at")
        .in("status", ["live", "scheduled"])
        .eq("published", true)
        .gte("updated_at", sinceISO)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("game_alerts")
        .select("id, title, message, severity, created_at, link_url")
        .eq("is_active", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("stories")
        .select("id, title, created_at, link_url")
        .eq("published", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("blog_posts")
        .select("id, title, slug, published_at")
        .eq("published", true)
        .gte("published_at", sinceISO)
        .order("published_at", { ascending: false })
        .limit(5),
    ]);

    const ls = lastSeen;

    (liveStreams.data || []).forEach((s) => {
      items.push({
        id: `live-${s.id}`, type: "live",
        title: s.status === "live" ? "🔴 LIVE NOW" : "Coming Soon",
        message: s.title, time: s.updated_at, link: "/metsxmfanzone",
        isNew: !ls || new Date(s.updated_at) > new Date(ls),
      });
    });

    (gameAlerts.data || []).forEach((a) => {
      items.push({
        id: `alert-${a.id}`, type: "game_alert",
        title: a.title, message: a.message, time: a.created_at,
        link: a.link_url || undefined,
        isNew: !ls || new Date(a.created_at) > new Date(ls),
      });
    });

    (stories.data || []).forEach((s) => {
      items.push({
        id: `story-${s.id}`, type: "story",
        title: "New Story", message: s.title, time: s.created_at,
        link: s.link_url || "/",
        isNew: !ls || new Date(s.created_at) > new Date(ls),
      });
    });

    (blogPosts.data || []).forEach((b) => {
      items.push({
        id: `blog-${b.id}`, type: "blog",
        title: "New Article", message: b.title, time: b.published_at || "",
        link: `/blog/${b.slug}`,
        isNew: !ls || new Date(b.published_at || "") > new Date(ls),
      });
    });

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setNotifications(items);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    saveDismissedIds(updated);
  };

  const handleClearAll = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedIds(allIds);
    saveDismissedIds(allIds);
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const now = new Date().toISOString();
      localStorage.setItem("notificationsLastSeen", now);
      setLastSeen(now);
      setUnreadCount(0);
    }
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <div className="relative">
          {children}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-primary flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </SheetTitle>
            {visibleNotifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </SheetHeader>
        <div className="overflow-y-auto h-full pb-20">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {visibleNotifications.map((n) => {
                const config = typeConfig[n.type];
                const Icon = config.icon;
                return (
                  <div
                    key={n.id}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer ${n.isNew ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      if (n.link) {
                        setOpen(false);
                        window.location.href = n.link;
                      }
                    }}
                  >
                    <div className={`mt-0.5 p-2 rounded-full bg-muted ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                        {n.isNew && <Dot className="w-4 h-4 text-destructive -ml-1" />}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.time ? formatDistanceToNow(new Date(n.time), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(e, n.id)}
                      className="mt-1 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationsPanel;
