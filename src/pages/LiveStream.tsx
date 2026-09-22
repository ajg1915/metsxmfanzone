import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Signal, Eye, Share2, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface StreamInfo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: string;
  assigned_pages: string[];
}

const LiveStream = () => {
  const { streamId } = useParams<{ streamId: string }>();
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
            .order("status", { ascending: false })
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
            .order("status", { ascending: false })
            .limit(1)
            .maybeSingle();

      setStream(publicData as StreamInfo | null);
      setLoading(false);
    };
    fetchStream();
  }, [streamId]);

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
    <StreamTimeLimit streamId={stream.id} pageKey={pageName} allowGuestPreview>
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

        <main className="flex-1 pt-12">
          <div className="relative">
            {stream.thumbnail_url && (
              <div
                className="absolute inset-0 h-[420px] bg-cover bg-center opacity-30"
                style={{ backgroundImage: `url(${stream.thumbnail_url})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
              </div>
            )}

            <div className="container mx-auto px-4 py-6 sm:py-8 relative z-10">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden bg-player sm:rounded-lg"
                  >
                    <StreamPlayer
                      pageName={pageName}
                      pageTitle={stream.title}
                      pageDescription={stream.description || "Live stream on MetsXMFanZone"}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-4 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {isLive ? (
                        <motion.div
                          animate={{ opacity: [1, 0.6, 1] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                          className="inline-flex items-center gap-1.5 bg-destructive text-destructive-foreground px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          LIVE NOW
                        </motion.div>
                      ) : (
                        <Badge variant="secondary" className="text-[11px]">
                          {stream.status.toUpperCase()}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[11px] gap-1">
                        <Signal className="w-3 h-3" /> HD Stream
                      </Badge>
                      <Badge variant="outline" className="text-[11px] gap-1">
                        <Tv className="w-3 h-3" /> MetsXMFanZone
                      </Badge>
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground leading-tight tracking-tight">
                      {stream.title}
                    </h1>

                    {stream.description && (
                      <p className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {stream.description}
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-primary" /> Live audience
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" /> Fans watching
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleShare}
                        className="h-8 text-xs"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </Button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </StreamTimeLimit>
  );
};

export default LiveStream;
