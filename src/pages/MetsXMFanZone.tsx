import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import { MLBScoresTicker } from "@/components/MLBScoresTicker";
import { NewPostAlert } from "@/components/NewPostAlert";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import TVGuide from "@/components/TVGuide";
import SEOHead from "@/components/SEOHead";
import { Users, Mic, Trophy, Signal, Tv, Film, CalendarDays } from "lucide-react";
import { ChannelSwitcher, METS_BRAND, StreamBrandHeader } from "@/components/streaming/StreamChrome";
import fanzoneLogo from "@/assets/metsxmfanzone-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { useMarkEngaged } from "@/hooks/useMarkEngaged";
import { GameTabsPanel, NoGameCard, ScoreStrip } from "@/components/live/LiveStatsSection";
import { useMetsLiveGame } from "@/lib/metsLiveGame";
import { ScheduledShowsSection } from "@/components/radio/ScheduledShowsSection";

// Default feed for the Watch Live page when no MetsXMFanZone stream is switched on:
// MetsXMFanZone Stream 3 (live audio show). When an admin turns a MetsXMFanZone
// stream live (TV, Stream 2, Stream 3...), the page follows it automatically.
const STREAM3_FEED_URL = "https://video1.getstreamhosting.com:1936/duuqkvxsmv/duuqkvxsmv/playlist.m3u8";
const METSXM_STREAM_URL = STREAM3_FEED_URL;
// "We'll be right back" video, looped whenever the live feed above isn't up.
const METSXM_STANDBY_URL = "https://media.metsxmfanzone.com/offline/offline.mp4";

type MoreStream = { id: string; title: string; thumbnail_url: string | null; status: string; scheduled_start: string | null };

const MetsXMFanZone = () => {
  useMarkEngaged();
  const navigate = useNavigate();
  const [moreStreams, setMoreStreams] = useState<MoreStream[]>([]);
  const [streamUrl, setStreamUrl] = useState(METSXM_STREAM_URL);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const live = useMetsLiveGame();
  const game = (live.state === "live" || live.state === "final") && live.game ? live.game : null;

  // Follow whichever MetsXMFanZone stream is live right now (newest start wins),
  // on desktop and phone alike. Re-checks on any change and every 30 seconds.
  useEffect(() => {
    let cancelled = false;
    const pick = async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("title, stream_url, actual_start")
        .eq("published", true)
        .eq("status", "live")
        .ilike("title", "%metsxmfanzone%")
        .order("actual_start", { ascending: false, nullsFirst: false })
        .limit(5);
      if (cancelled || !data) return;
      const live = data.find((s: any) => s.stream_url && !/24\/7|24-7|24x7/i.test(s.title || ""));
      const next = live?.stream_url?.trim() || METSXM_STREAM_URL;
      setStreamUrl((cur) => (cur === next ? cur : next));
      setLiveTitle(live?.title || null);
    };
    pick();
    const timer = setInterval(pick, 30000);
    const channel = supabase
      .channel("watch-page-live-streams")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, pick)
      .subscribe();
    return () => {
      cancelled = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);





  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id, title, thumbnail_url, status, scheduled_start")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .order("scheduled_start", { ascending: true })
        .limit(4);
      if (data) setMoreStreams(data as MoreStream[]);
    })();
  }, []);

  const moreList = moreStreams.length > 0 && (
    <div role="region" aria-label="More streams" className="rounded-2xl border border-border/50 bg-card/80 p-4">
      <h2 className="mb-3 font-display text-[22px] font-bold uppercase leading-none tracking-wide text-foreground">More Streams</h2>
      <div className="flex flex-col gap-3">
        {moreStreams.map((st) => (
          <button key={st.id} type="button" onClick={() => navigate(`/live/${st.id}`)} className="flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-white/5">
            <div className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-secondary/60 to-card">
              {st.thumbnail_url && <img src={st.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
              {st.status === "live" && (
                <span className="absolute left-1 top-1 rounded-[3px] bg-red-700 px-1.5 py-px text-[9px] font-extrabold tracking-[0.08em] text-white">LIVE</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[15px] font-bold leading-tight text-foreground">{st.title}</p>
              {st.scheduled_start && (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{format(parseISO(st.scheduled_start), "EEE, MMM d \u2022 h:mm a")}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <StreamTimeLimit>
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="MetsXMFanZone TV - Watch Live Mets Shows & Exclusive Content"
        description="Watch MetsXMFanZone TV for exclusive Mets live shows, fan discussions, and 24/7 coverage. Your ultimate destination for Mets content."
        canonical="https://www.metsxmfanzone.com/metsxmfanzone"
        keywords="MetsXMFanZone TV, Mets live show, Mets fan TV, exclusive Mets content, Mets 24/7"
        ogType="video.other"
      />
      <Navigation />

      <main className="flex-1 pt-12 max-md:pt-14">
        <StreamBrandHeader
          brand={METS_BRAND}
          mark={<img src={fanzoneLogo} alt="" className="h-full w-full object-contain p-1.5" />}
          title="MetsXMFanZone"
          titleAccent="TV"
          badges={[<><Signal className="h-3 w-3" /> Live now</>, <><Tv className="h-3 w-3" /> HD Quality</>]}
        />

        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/15 via-secondary/5 to-transparent" />

          <div className="container relative z-10 mx-auto max-w-[1400px] px-0 pb-24 pt-0 sm:px-4 sm:pt-4 md:pb-10 lg:px-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Main column: player, status, game center */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="hidden overflow-hidden rounded-xl border border-border/60 shadow-lg shadow-primary/10 md:block">
                  <MLBScoresTicker />
                </div>

                {/* 16:9 player, clean: nothing is drawn over the video */}
                <div className="stream-player-shell relative aspect-video w-full overflow-hidden bg-player max-sm:!mx-0 sm:rounded-lg">
                  <ClapprPlayer
                    key={streamUrl}
                    source={streamUrl}
                    fallbackSource={METSXM_STANDBY_URL}
                    pageTitle="MetsXMFanZone Live Stream"
                    pageDescription="Ultimate Destination Where the Fans Go"
                    showChrome={false}
                  />
                  <NewPostAlert />
                </div>

                {/* Status bar under the player */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
                  <div className="flex min-w-0 items-center gap-3">
                    {liveTitle ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-700/90 px-3 py-1 text-[11px] font-extrabold tracking-[0.1em] text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE NOW
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-[0.1em] text-foreground">
                        <Signal className="h-3 w-3" /> STREAMING
                      </span>
                    )}
                    <h2 className="truncate font-display text-[22px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-2xl">
                      {liveTitle || "MetsXMFanZone TV"}
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <Link to="/replay-games" className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/50">
                      <Film className="h-4 w-4 text-primary" /> Replays
                    </Link>
                    <Link to="/mets-schedule-2027" className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/50">
                      <CalendarDays className="h-4 w-4 text-primary" /> Schedule
                    </Link>
                  </div>
                </div>

                {/* Score bar + line score in a game, otherwise the next-game card */}
                <div className="px-4 sm:px-0">
                  {game ? (
                    <ScoreStrip g={game} />
                  ) : (
                    live.state !== "loading" && <NoGameCard next={live.next} offseason={live.state === "offseason"} pregame={live.state === "pregame"} />
                  )}
                </div>

                {/* Phone / tablet: Game Center tabs right under the score (desktop shows them in the side column) */}
                {game && (
                  <div className="px-4 sm:px-0 lg:hidden">
                    <GameTabsPanel g={game} />
                  </div>
                )}

                <ChannelSwitcher activeKey="metsxmfanzone" className="max-md:px-4" />

                <TVGuide className="max-md:mx-4" />

                <div className="hidden grid-cols-3 gap-3 md:grid">
                  {[
                    { icon: Mic, title: "Live Shows", text: "Fan discussions & reactions" },
                    { icon: Users, title: "Community", text: "Connect with fellow fans" },
                    { icon: Trophy, title: "Exclusive", text: "Interviews & analysis" },
                  ].map(({ icon: Icon, title, text }) => (
                    <div key={title} className="rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors hover:border-primary/40">
                      <Icon className="mb-2 h-5 w-5 text-primary" />
                      <p className="text-sm font-bold text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Side column: show schedule, more streams, follow */}
              <aside className="flex min-w-0 flex-col gap-4 px-4 sm:px-0">
                {game && (
                  <div className="hidden lg:block">
                    <GameTabsPanel g={game} />
                  </div>
                )}
                <ScheduledShowsSection />
                {moreList}
              </aside>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </StreamTimeLimit>
  );
};

export default MetsXMFanZone;
