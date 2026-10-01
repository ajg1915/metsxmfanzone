import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import { isNYSportsPackageStream } from "@/lib/nyTeamStreamCheck";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Signal, Share2, Radio, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import SocialLinksSection from "@/components/SocialLinksSection";
import { ChannelSwitcher, METS_BRAND, StreamBrandHeader } from "@/components/streaming/StreamChrome";
import logo from "@/assets/metsxmfanzone-logo.png";
import TVGuide from "@/components/TVGuide";

interface StreamInfo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: string;
  assigned_pages: string[];
}

type MoreStream = { id: string; title: string; thumbnail_url: string | null; status: string; scheduled_start: string | null };

const LiveStream = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const [more, setMore] = useState<MoreStream[]>([]);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamId) return;
    const fetchStream = async () => {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const query = supabase
        .from("live_streams")
        .select("id, title, description, thumbnail_url, status, assigned_pages")
        .eq("published", true);

      const { data } = UUID_RE.test(streamId)
        ? await query.eq("id", streamId).maybeSingle()
        : await query
            .contains("assigned_pages", [streamId])
            .eq("status", "live")
            .order("scheduled_start", { ascending: false })
            .limit(1)
            .maybeSingle();

      if (data) {
        setStream(data as StreamInfo | null);
        setLoading(false);
        return;
      }

      // Logged-out visitors can't read the restricted table: use the public view
      const publicQuery = supabase
        .from("live_streams_public")
        .select("id, title, description, thumbnail_url, status, assigned_pages");

      const { data: publicData } = UUID_RE.test(streamId)
        ? await publicQuery.eq("id", streamId).maybeSingle()
        : await publicQuery
            .contains("assigned_pages", [streamId])
            .eq("status", "live")
            .order("scheduled_start", { ascending: false })
            .limit(1)
            .maybeSingle();

      setStream(publicData as StreamInfo | null);
      setLoading(false);
    };
    fetchStream();
  }, [streamId]);

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id, title, thumbnail_url, status, scheduled_start")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .neq("id", stream.id)
        .order("scheduled_start", { ascending: true })
        .limit(8);
      if (!cancelled && data) setMore(data as MoreStream[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [stream]);

  const handleShare = async () => {
    if (!stream) return;
    const url = new URL(window.location.href);
    url.protocol = "https:";
    url.hostname = "metsxmfanzone.com";
    url.port = "";
    const shareUrl = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: stream.title, url: shareUrl });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 pt-12 container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="aspect-video w-full max-w-6xl" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 pt-12 container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Stream Not Found</h1>
          <p className="text-muted-foreground">This stream doesn't exist or has been removed.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const pageName = streamId && !UUID_RE.test(streamId) ? streamId : `stream-${stream.id}`;
  const isLive = stream.status === "live";

  return (
    <StreamTimeLimit streamId={stream.id} pageKey={pageName} allowGuestPreview nySportsStream={isNYSportsPackageStream(stream, pageName)}>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title={`${stream.title} - Live Stream | MetsXMFanZone`}
          description={stream.description || `Watch ${stream.title} live on MetsXMFanZone`}
          canonical={`https://metsxmfanzone.com/live/${stream.id}`}
          keywords="live stream, mets, baseball, watch live"
          ogType="video.other"
          ogImage={stream.thumbnail_url || "/share/metsxmfanzone.jpg"}
          ogImageAlt={`${stream.title} live on MetsXMFanZone`}
        />
        <Navigation />

        <main className="flex-1 pt-14 max-md:pb-24 sm:pt-16">
          <StreamBrandHeader
            brand={METS_BRAND}
            mark={<img src={logo} alt="" className="h-full w-full object-contain p-1.5" />}
            title={stream.title}
            badges={[<><Signal className="h-3 w-3" /> HD</>, <><Tv className="h-3 w-3" /> MetsXMFanZone</>]}
            action={<Button size="icon" variant="outline" onClick={handleShare} aria-label="Share this stream" className="h-11 w-11 shrink-0 rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"><Share2 className="h-5 w-5" /></Button>}
          />
          <div className="relative">
            {stream.thumbnail_url && (
              <div
                className="absolute inset-x-0 top-0 h-[360px] bg-cover bg-center opacity-25"
                style={{ backgroundImage: `url(${stream.thumbnail_url})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
              </div>
            )}

            <div className="container relative z-10 mx-auto max-w-6xl px-0 sm:px-4 sm:pt-5">
              {/* Player: edge to edge on phones */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
                className="bg-player sm:overflow-hidden sm:rounded-xl"
              >
                <StreamPlayer
                  pageName={pageName}
                  pageTitle={stream.title}
                  pageDescription={stream.description || "Live stream on MetsXMFanZone"}
                />
              </motion.div>

              <div className="px-4 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded bg-red-700 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.1em] text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      LIVE NOW
                    </span>
                  ) : (
                    <Badge variant="secondary" className="text-[11px]">
                      {stream.status.toUpperCase()}
                    </Badge>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground">
                    <Signal className="h-3 w-3" /> HD
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-foreground">
                    <Tv className="h-3 w-3" /> MetsXMFanZone
                  </span>
                </div>

                {stream.description && (
                  <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">{stream.description}</p>
                )}

                <TVGuide className="mt-6" />

                <ChannelSwitcher className="mt-6" />

                {more.length > 0 && (
                  <section aria-label="More streams" className="mt-7">
                    <h2 className="mb-3 font-display text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-3xl">More streams</h2>
                    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:px-0">
                      {more.map((m) => (
                        <Link
                          key={m.id}
                          to={`/live/${m.id}`}
                          className="group w-[72vw] max-w-[300px] shrink-0 snap-start sm:w-[280px]"
                        >
                          <div className="relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-secondary/60 to-card">
                            {m.thumbnail_url && <img src={m.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                            <span
                              className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white ${
                                m.status === "live" ? "bg-red-700" : "bg-black/60"
                              }`}
                            >
                              {m.status === "live" ? <Radio className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                              {m.status === "live" ? "LIVE" : "UPCOMING"}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-tight text-foreground group-hover:text-primary">{m.title}</p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
          <SocialLinksSection />
        </main>

        <Footer />
      </div>
    </StreamTimeLimit>
  );
};

export default LiveStream;
