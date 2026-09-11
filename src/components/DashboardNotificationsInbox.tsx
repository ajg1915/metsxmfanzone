import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Tv, FileText, MessageSquare, Trophy, Newspaper, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Item = {
  id: string;
  type: "live" | "game_alert" | "story" | "blog";
  title: string;
  message: string;
  time: string;
  link?: string;
};

const typeConfig = {
  live: { icon: Tv, label: "Live Now", color: "text-red-500" },
  game_alert: { icon: Trophy, label: "Game Alert", color: "text-amber-500" },
  story: { icon: MessageSquare, label: "New Story", color: "text-blue-500" },
  blog: { icon: Newspaper, label: "New Article", color: "text-emerald-500" },
};

const DashboardNotificationsInbox = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceISO = since.toISOString();

    const [liveStreams, gameAlerts, stories, blogPosts] = await Promise.all([
      supabase
        .from("live_streams")
        .select("id, title, status, updated_at")
        .in("status", ["live", "scheduled"])
        .eq("published", true)
        .gte("updated_at", sinceISO)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("game_alerts")
        .select("id, title, message, created_at, link_url")
        .eq("is_active", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("stories")
        .select("id, title, created_at, link_url")
        .eq("published", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("blogs")
        .select("id, title, slug, published_at")
        .eq("published", true)
        .gte("published_at", sinceISO)
        .order("published_at", { ascending: false })
        .limit(10),
    ]);

    const list: Item[] = [];
    (liveStreams.data || []).forEach((s: any) =>
      list.push({
        id: `live-${s.id}`,
        type: "live",
        title: s.status === "live" ? "🔴 LIVE NOW" : "Coming Soon",
        message: s.title,
        time: s.updated_at,
        link: "/metsxmfanzone",
      })
    );
    (gameAlerts.data || []).forEach((a: any) =>
      list.push({
        id: `alert-${a.id}`,
        type: "game_alert",
        title: a.title,
        message: a.message,
        time: a.created_at,
        link: a.link_url || undefined,
      })
    );
    (stories.data || []).forEach((s: any) =>
      list.push({
        id: `story-${s.id}`,
        type: "story",
        title: "New Story",
        message: s.title,
        time: s.created_at,
        link: s.link_url || "/",
      })
    );
    (blogPosts.data || []).forEach((b: any) =>
      list.push({
        id: `blog-${b.id}`,
        type: "blog",
        title: "New Article",
        message: b.title,
        time: b.published_at || "",
        link: `/blog/${b.slug}`,
      })
    );

    list.sort((a, b) => +new Date(b.time) - +new Date(a.time));
    setItems(list.slice(0, 30));
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="bg-card/90 backdrop-blur-xl border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-primary" />
          Notifications
        </CardTitle>
        <CardDescription>
          Live streams, game alerts, stories, and articles from the last 14 days
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
            {items.map((n) => {
              const cfg = typeConfig[n.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.link) window.location.href = n.link;
                  }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className={`mt-0.5 p-2 rounded-full bg-muted ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {n.time ? formatDistanceToNow(new Date(n.time), { addSuffix: true }) : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardNotificationsInbox;
