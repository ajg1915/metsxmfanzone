import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, ExternalLink, BellOff } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface AdminAlert {
  id: string;
  message: string;
  link_url: string | null;
  created_at: string;
}

export default function AdminAlertsFeed() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useSubscription();

  const load = async () => {
    const { data } = await supabase
      .from("live_notifications")
      .select("id, message, link_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    setAlerts((data as AdminAlert[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-alerts-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_notifications" },
        () => load(),
      )
      .subscribe();

    // Polling fallback so the feed still refreshes if realtime is unavailable
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-background/40">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-8">Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 text-muted-foreground">
            <BellOff className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-semibold">No admin alerts yet</p>
            <p className="text-[10px] mt-1 opacity-70">Updates will appear here in real time</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="relative rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card/70 to-card/40 backdrop-blur-md p-3 shadow-sm hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] uppercase tracking-[0.15em] font-black text-primary">
                      {isAdmin ? "Admin Alert" : "Game Alert"}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      · {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-snug whitespace-pre-wrap break-words">
                    {alert.message}
                  </p>
                  {alert.link_url && (
                    <a
                      href={alert.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-primary hover:underline"
                    >
                      View details <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-3 py-2 border-t border-border/40 bg-card/50 text-[9px] text-center text-muted-foreground uppercase tracking-wider">
        Official MetsXMFanZone Alerts · Read Only
      </div>
    </div>
  );
}
