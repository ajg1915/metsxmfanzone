import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radio, Users, MapPin, MousePointerClick, Smartphone, Monitor, Tablet, Globe } from "lucide-react";

interface Visitor {
  id: string;
  session_id: string;
  current_page: string;
  page_type: string | null;
  is_authenticated: boolean | null;
  device_type: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  entry_page: string | null;
  referrer_source: string | null;
  referrer_url: string | null;
  stream_title: string | null;
  last_seen_at: string;
}

interface ClickEvent {
  id: string;
  session_id: string;
  page_path: string;
  element_label: string | null;
  element_href: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const deviceIcon = (device: string | null) => {
  if (device === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (device === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  if (device === "desktop") return <Monitor className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
};

const locationLabel = (v: { city?: string | null; region?: string | null; country?: string | null }) => {
  const parts = [v.city, v.region, v.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
};

export default function LiveVisitorsMonitor() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const notifiedStreamSessions = useRef<Set<string>>(new Set());

  const load = async () => {
    const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
    const [{ data: presence }, { data: clickRows }] = await Promise.all([
      supabase
        .from("realtime_presence")
        .select("*")
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false }),
      supabase
        .from("visitor_clicks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
    setVisitors((presence || []) as Visitor[]);
    setClicks((clickRows || []) as ClickEvent[]);
  };

  useEffect(() => {
    load();

    // Collapse bursts of presence updates into one refresh.
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(load, 2000);
    };

    const channel = supabase
      .channel("admin-live-visitors")
      .on("postgres_changes", { event: "*", schema: "public", table: "realtime_presence" }, (payload) => {
        const row = payload.new as Visitor | undefined;
        if (row && row.page_type === "stream" && !notifiedStreamSessions.current.has(row.session_id)) {
          notifiedStreamSessions.current.add(row.session_id);
          toast.info("🔴 New live stream viewer", {
            description: `${row.is_authenticated ? "Member" : "Guest"} from ${locationLabel(row)} • ${row.current_page}`,
          });
        }
        debouncedLoad();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visitor_clicks" }, (payload) => {
        setClicks((prev) => [payload.new as ClickEvent, ...prev].slice(0, 60));
      })
      .subscribe();

    const interval = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  const streamViewers = visitors.filter((v) => v.page_type === "stream");
  const organic = visitors.filter((v) => v.referrer_source === "search" || v.referrer_source === "direct");

  const locations = Object.entries(
    visitors.reduce<Record<string, number>>((acc, v) => {
      const key = locationLabel(v);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const stat = (label: string, value: number, Icon: typeof Users) => (
    <Card className="bg-card/90 backdrop-blur border-border/60">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {stat("On site now", visitors.length, Users)}
        {stat("Watching live streams", streamViewers.length, Radio)}
        {stat("Organic visitors", organic.length, Globe)}
        {stat("Clicks tracked (recent)", clicks.length, MousePointerClick)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-card/90 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Live visitors &amp; stream viewers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ScrollArea className="h-[320px] pr-2">
              {visitors.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">No active visitors right now.</p>
              )}
              <div className="space-y-2">
                {visitors.map((v) => (
                  <div key={v.id} className="rounded-lg border border-border/50 bg-background/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {deviceIcon(v.device_type)}
                        <span className="text-xs font-medium truncate">{v.current_page}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {v.page_type === "stream" && <Badge className="text-[10px] px-1.5 py-0">WATCHING</Badge>}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {v.is_authenticated ? "Member" : "Guest"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{locationLabel(v)}</span>
                      <span>Source: {v.referrer_source || "direct"}</span>
                      <span>Landed on: {v.entry_page || "—"}</span>
                      <span>{new Date(v.last_seen_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-card/90 backdrop-blur border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-primary" /> Click activity (what they clicked)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ScrollArea className="h-[320px] pr-2">
              {clicks.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">No clicks recorded yet.</p>
              )}
              <div className="space-y-1.5">
                {clicks.map((c) => (
                  <div key={c.id} className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5">
                    <p className="text-xs font-medium truncate">{c.element_label || c.element_href || "Interaction"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {c.page_path} • {locationLabel(c)} • {new Date(c.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/90 backdrop-blur border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Where visitors are right now
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex flex-wrap gap-2">
          {locations.length === 0 && <p className="text-xs text-muted-foreground">No location data yet.</p>}
          {locations.map(([loc, count]) => (
            <Badge key={loc} variant="secondary" className="text-[11px]">
              {loc} · {count}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
