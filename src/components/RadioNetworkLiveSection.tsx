import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Radio, Users, Play, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceRoom {
  id: string;
  name: string;
  description: string | null;
  livekit_room_name: string;
  is_active: boolean;
  max_participants: number;
  image_url?: string | null;
  status?: string;
}

const RadioNetworkLiveSection = () => {
  const { user } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const canSee = !!user && isPremium;

  useEffect(() => {
    if (!canSee) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("gameday_voice_rooms")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (mounted) {
        setRooms((data || []) as VoiceRoom[]);
        setLoading(false);
      }
    };
    load();
    const channel = supabase
      .channel("homepage_radio_network_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_voice_rooms" },
        load
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [canSee]);

  // Hidden completely for non-members
  if (subLoading) return null;
  if (!canSee) return null;
  if (loading) return null;
  if (rooms.length === 0) return null;

  const featured = rooms[0];
  const others = rooms.slice(1);

  return (
    <section className="py-6 sm:py-8 px-3 sm:px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Radio className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Radio Network — Live Now
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Members-only voice rooms airing right now
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/gameday-live">View all</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Featured tile */}
          <Link
            to="/gameday-live"
            className="lg:col-span-2 group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/20 via-background to-background hover:border-primary/50 transition-all"
          >
            <div className="relative aspect-[16/9] sm:aspect-[21/9] overflow-hidden">
              {featured.image_url ? (
                <img
                  src={featured.image_url}
                  alt={featured.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/10 to-background flex items-center justify-center">
                  <Radio className="w-20 h-20 text-primary/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

              {/* Live badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live
              </div>

              {/* Content overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <p className="text-[10px] sm:text-xs uppercase tracking-widest text-primary font-semibold mb-1">
                  Featured Channel
                </p>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 line-clamp-2">
                  {featured.name}
                </h3>
                {featured.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3 max-w-2xl">
                    {featured.description}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    className="rounded-full font-semibold gap-1.5 group-hover:scale-105 transition-transform"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Tune In
                  </Button>
                  <span className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    Up to {featured.max_participants}
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Channel list */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1">
              All Channels
            </p>
            {others.length === 0 ? (
              <Link
                to="/gameday-live"
                className="block p-4 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                <Headphones className="w-5 h-5 mx-auto mb-1.5 opacity-60" />
                More channels coming soon — explore the Radio Network
              </Link>
            ) : (
              others.slice(0, 5).map((room) => (
                <Link
                  key={room.id}
                  to="/gameday-live"
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-primary/40 transition-all group"
                >
                  <div className="relative flex-shrink-0">
                    {room.image_url ? (
                      <img
                        src={room.image_url}
                        alt={room.name}
                        className="w-11 h-11 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {room.name}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                      On Air now
                    </p>
                  </div>
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:fill-current transition-colors flex-shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RadioNetworkLiveSection;
