import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Music2, Facebook, Headphones, Music, Podcast as PodcastIcon, Video, Instagram, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/metsxmfanzone-logo.png";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import BlogSection from "@/components/BlogSection";

interface PodcastLiveStream {
  id: string;
  title: string;
  description: string | null;
  vdo_ninja_url: string | null;
  is_live: boolean;
}

const channels = [
  {
    name: "TikTok",
    icon: Music2,
    url: "https://www.tiktok.com/@metsxmfanzone",
    gradient: "from-black to-gray-800",
  },
  {
    name: "Facebook",
    icon: Facebook,
    url: "https://www.facebook.com/metsxmfanzoneofficial",
    gradient: "from-blue-600 to-blue-800",
  },
  {
    name: "Instagram",
    icon: Instagram,
    url: "https://www.instagram.com/metsxmfanzone",
    gradient: "from-pink-500 via-purple-500 to-orange-400",
  },
  {
    name: "X (Twitter)",
    icon: Twitter,
    url: "https://twitter.com/metsxmfanzone",
    gradient: "from-gray-800 to-black",
  },
  {
    name: "Spotify",
    icon: Music,
    url: "https://open.spotify.com",
    gradient: "from-green-500 to-green-700",
  },
  {
    name: "Apple Podcasts",
    icon: PodcastIcon,
    url: "https://podcasts.apple.com",
    gradient: "from-purple-500 to-purple-700",
  },
  {
    name: "iHeartRadio",
    icon: Radio,
    url: "https://www.iheart.com",
    gradient: "from-red-500 to-red-700",
  },
  {
    name: "Amazon Music",
    icon: Headphones,
    url: "https://music.amazon.com",
    gradient: "from-orange-400 to-orange-600",
  },
  {
    name: "YouTube",
    icon: Video,
    url: "https://www.youtube.com/@metsxmfanzone",
    gradient: "from-red-600 to-red-800",
  },
];

const Podcast = () => {
  const [liveStream, setLiveStream] = useState<PodcastLiveStream | null>(null);

  useEffect(() => {
    fetchLiveStream();

    const channel = supabase
      .channel('podcast-live-stream')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'podcast_live_stream'
        },
        (payload) => {
          if (payload.new) {
            setLiveStream(payload.new as PodcastLiveStream);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveStream = async () => {
    try {
      const { data, error } = await supabase
        .from("podcast_live_stream")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLiveStream(data ?? null);
    } catch (error) {
      console.error("Error fetching live stream:", error);
    }
  };

  const isLive = liveStream?.is_live;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="MetsXMFanZone - Find Us Everywhere"
        description="Follow MetsXMFanZone on all platforms. Listen on Spotify, Apple Podcasts, iHeartRadio, and watch live on TikTok, Facebook, Instagram, YouTube and more."
        keywords="Mets podcast, MetsXMFanZone social media, Mets TikTok, Mets Instagram, Mets live stream"
        canonical="https://www.metsxmfanzone.com/podcast"
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={logo} alt="MetsXMFanZone" className="w-10 h-10 sm:w-12 sm:h-12" />
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-primary">
                MetsXMFanZone
              </h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              Find us on all your favorite platforms — follow, listen, and watch live
            </p>
          </div>

          {/* Live Indicator */}
          {isLive && (
            <div className="mb-8 sm:mb-10">
              <Card className="border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-red-500/10 overflow-hidden">
                <CardContent className="py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <Badge variant="destructive" className="text-xs sm:text-sm font-bold animate-pulse">
                      LIVE NOW
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-foreground text-center">
                    {liveStream?.title || "We're live right now!"} — {liveStream?.description || "Tune in on our social channels!"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* All Channels Grid */}
          <section className="mb-8 sm:mb-12">
            <h2 className="text-lg sm:text-xl font-bold text-center mb-6">Find Us On</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
              {channels.map((channel) => {
                const IconComponent = channel.icon;
                return (
                  <a
                    key={channel.name}
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    <Card className="hover:shadow-xl transition-all duration-300 border hover:border-primary/50 overflow-hidden h-full">
                      <CardContent className="p-0">
                        <div className={`bg-gradient-to-br ${channel.gradient} p-4 sm:p-6 flex flex-col items-center justify-center gap-2 text-white`}>
                          <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 group-hover:scale-110 transition-transform duration-300" />
                          <p className="font-bold text-xs sm:text-sm">{channel.name}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                );
              })}
            </div>
          </section>

          {/* Blog Section */}
          <BlogSection />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Podcast;
