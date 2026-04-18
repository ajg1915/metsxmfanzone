import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Mic, ExternalLink, Radio } from "lucide-react";
import { format, isAfter, isBefore, addMinutes } from "date-fns";

interface ScheduledShow {
  id: string;
  title: string;
  host_name: string;
  description: string | null;
  cover_image_url: string | null;
  scheduled_start: string;
  duration_minutes: number;
  stream_url: string | null;
  is_live: boolean;
}

export function ScheduledShowsSection() {
  const [shows, setShows] = useState<ScheduledShow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("radio_scheduled_shows")
      .select("*")
      .eq("published", true)
      .gte("scheduled_start", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(8);
    setShows((data as ScheduledShow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("radio_shows_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_scheduled_shows" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (loading) return null;

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Scheduled Shows</h3>
      </div>

      {shows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          No upcoming shows scheduled. Check back soon.
        </p>
      ) : (
        <div className="space-y-2">
          {shows.map((show) => {
            const start = new Date(show.scheduled_start);
            const end = addMinutes(start, show.duration_minutes);
            const now = new Date();
            const isLiveNow =
              show.is_live || (isAfter(now, start) && isBefore(now, end));
            const isUpcoming = isBefore(now, start);

            return (
              <div
                key={show.id}
                className="flex gap-3 rounded-lg border border-border p-3 bg-background/30"
              >
                {show.cover_image_url ? (
                  <img
                    src={show.cover_image_url}
                    alt={show.title}
                    className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-0.5">
                    <p className="font-semibold text-sm truncate flex-1">{show.title}</p>
                    {isLiveNow && (
                      <Badge className="bg-red-500 hover:bg-red-500 text-white text-[10px] h-5 gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </Badge>
                    )}
                    {!isLiveNow && isUpcoming && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        Upcoming
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Hosted by {show.host_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <CalendarDays className="w-3 h-3" />
                    {format(start, "EEE, MMM d • h:mm a")}
                  </div>
                  {show.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {show.description}
                    </p>
                  )}
                  {isLiveNow && show.stream_url && (
                    <Button
                      asChild
                      size="sm"
                      className="h-6 text-[11px] mt-1.5 gap-1"
                    >
                      <a href={show.stream_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                        Tune In
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
