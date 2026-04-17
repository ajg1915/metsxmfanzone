import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import LiveStreamChat from "@/components/LiveStreamChat";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Radio, Tv, Signal } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

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
      const { data } = await supabase
        .from("live_streams")
        .select("id, title, description, thumbnail_url, status, assigned_pages")
        .eq("id", streamId)
        .maybeSingle();
      setStream(data as StreamInfo | null);
      setLoading(false);
    };
    fetchStream();
  }, [streamId]);

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

  // Use the stream's ID as the pageName so StreamPlayer can match it
  const pageName = `stream-${stream.id}`;

  return (
    <StreamTimeLimit>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title={`${stream.title} - Live Stream | MetsXMFanZone`}
          description={stream.description || `Watch ${stream.title} live on MetsXMFanZone`}
          canonical={`https://www.metsxmfanzone.com/live/${stream.id}`}
          keywords="live stream, mets, baseball, watch live"
          ogType="video.other"
        />
        <Navigation />

        <main className="flex-1 pt-12">
          {/* Stream Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/80 via-primary/40 to-background">
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-20 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {stream.thumbnail_url ? (
                    <img
                      src={stream.thumbnail_url}
                      alt={stream.title}
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl">
                      <Tv className="w-10 h-10 text-primary-foreground" />
                    </div>
                  )}
                  {stream.status === "live" && (
                    <motion.div
                      className="absolute -top-2 -right-2 flex items-center gap-1 bg-destructive text-destructive-foreground px-2 py-1 rounded-full text-xs font-bold shadow-lg"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Radio className="w-3 h-3" />
                      LIVE
                    </motion.div>
                  )}
                </motion.div>

                <div className="flex-1">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        <Signal className="w-3 h-3 mr-1" />
                        Live Stream
                      </Badge>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2 leading-tight">
                      {stream.title}
                    </h1>
                    {stream.description && (
                      <p className="text-white/70 text-sm sm:text-base max-w-xl">
                        {stream.description}
                      </p>
                    )}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* Stream Player */}
          <div className="container mx-auto px-4 py-6 sm:py-8">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <StreamPlayer
                  pageName={pageName}
                  pageTitle={stream.title}
                  pageDescription={stream.description || "Live stream on MetsXMFanZone"}
                />
              </motion.div>

              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <LiveStreamChat streamId={stream.id} streamTitle={stream.title} />
              </motion.div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </StreamTimeLimit>
  );
};

export default LiveStream;
