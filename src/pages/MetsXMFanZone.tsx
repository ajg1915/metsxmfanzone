import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import { MLBScoresTicker } from "@/components/MLBScoresTicker";
import { NewPostAlert } from "@/components/NewPostAlert";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import TVGuide from "@/components/TVGuide";
import SEOHead from "@/components/SEOHead";
import { Users, Mic, Trophy, Signal, Tv } from "lucide-react";
import { ChannelSwitcher, METS_BRAND, StreamBrandHeader } from "@/components/streaming/StreamChrome";
import fanzoneLogo from "@/assets/metsxmfanzone-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import SocialLinksSection, { METSXMFANZONE_SOCIALS } from "@/components/SocialLinksSection";

// MetsXMFanZone Live always plays this feed.
const METSXM_STREAM_URL = "https://stream2.metsxmfanzone.com/hls/mystream.m3u8";
// Looping standby shown whenever the live feed above isn't up.
const METSXM_STANDBY_URL = "https://metsxmfanzone.metsxmfanzone.com/hls-standby/metsxmfanzone.m3u8";

type MoreStream = { id: string; title: string; thumbnail_url: string | null; status: string; scheduled_start: string | null };

const MetsXMFanZone = () => {
  const navigate = useNavigate();
  const [moreStreams, setMoreStreams] = useState<MoreStream[]>([]);
  const streamUrl = METSXM_STREAM_URL;





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

        {/* Ambient backdrop */}
        <div className="relative">
          <div className="absolute inset-0 h-[520px] pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/10 to-transparent" />
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
          </div>

          {/* Player + TV guide */}
          <div className="container mx-auto px-3 sm:px-4 pt-4 pb-8 relative z-10 max-w-[1400px] max-md:px-0 max-md:pt-0 max-md:pb-24">
            <div className="grid grid-cols-1 gap-4 lg:gap-5">
              {/* Player + meta */}
              <div className="flex flex-col gap-4 min-w-0">
                {/* MLB Live Scores Ticker (scrolls left, above player) - hidden on mobile */}
                <div className="hidden md:block rounded-xl overflow-hidden border border-border/60 shadow-lg shadow-primary/10">
                  <MLBScoresTicker />
                </div>

                {/* 16:9 Player */}
                <div className="stream-player-shell relative aspect-video w-full overflow-hidden bg-player max-sm:!mx-0 sm:rounded-lg">
                  <ClapprPlayer
                    source={streamUrl}
                    fallbackSource={METSXM_STANDBY_URL}
                    pageTitle="MetsXMFanZone Live Stream"
                    pageDescription="Ultimate Destination Where the Fans Go"
                    showChrome={false}
                  />
                  <NewPostAlert />
                </div>

                <TVGuide className="max-md:mx-4" />

                {/* Phone: stream title, follow chips, more streams */}
                <div className="flex flex-col gap-4 px-4 md:hidden">
                  <div className="-mx-4">
                    <p className="mb-2 px-4 text-[11px] font-extrabold tracking-[0.18em] text-primary">FOLLOW @METSXMFANZONE</p>
                    <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
                      {METSXMFANZONE_SOCIALS.map((l) => (
                        <a
                          key={l.name}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-11 shrink-0 items-center rounded-full border border-border/60 bg-card px-4 text-sm font-bold text-foreground"
                        >
                          {l.name}
                        </a>
                      ))}
                    </div>
                  </div>
                  {moreStreams.length > 0 && (
                    <div>
                      <h2 className="mb-2 font-display text-[25px] uppercase leading-none tracking-wide">More Streams</h2>
                      <div className="flex flex-col gap-3">
                        {moreStreams.map((st) => (
                          <button key={st.id} type="button" onClick={() => navigate(`/live/${st.id}`)} className="flex items-center gap-3 text-left">
                            <div className="relative h-[63px] w-28 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-secondary/60 to-card">
                              {st.thumbnail_url && <img src={st.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                              {st.status === "live" && (
                                <span className="absolute left-1 top-1 rounded-[3px] bg-red-700 px-1.5 py-px text-[9px] font-extrabold tracking-[0.08em] text-white">LIVE</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-[15px] font-bold leading-tight text-foreground">{st.title}</p>
                              {st.scheduled_start && (
                                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{format(parseISO(st.scheduled_start), "EEE, MMM d • h:mm a")}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <ChannelSwitcher activeKey="metsxmfanzone" className="max-md:px-4" />

                {/* Channel info pills */}
                <div className="hidden grid-cols-3 gap-2 sm:gap-3 md:grid">
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Mic className="w-4 h-4 text-primary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Live Shows</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Fan discussions & reactions</p>
                  </div>
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Users className="w-4 h-4 text-secondary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Community</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Connect with fellow fans</p>
                  </div>
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Trophy className="w-4 h-4 text-primary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Exclusive</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Interviews & analysis</p>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <SocialLinksSection />
        </div>
      </main>
      
      <Footer />
    </div>
    </StreamTimeLimit>
  );
};

export default MetsXMFanZone;
