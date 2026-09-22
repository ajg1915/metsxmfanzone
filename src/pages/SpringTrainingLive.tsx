import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

import MetsRSSFeed from "@/components/MetsRSSFeed";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, Tv, Clock, MapPin, Users, Sun, Calendar, TrendingUp, Facebook, BarChart3 } from "lucide-react";

const getMatchupRoute = (title: string): string | null => {
  const t = title.toLowerCase();
  if (t.includes("astros") || t.includes("houston")) return "/matchup/astros";
  if (t.includes("braves") || t.includes("atlanta")) return "/matchup/braves";
  if (t.includes("cardinals") || t.includes("st. louis") || t.includes("stl")) return "/matchup/cardinals";
  if (t.includes("nationals") || t.includes("washington")) return "/matchup/nationals";
  if (t.includes("red sox") || t.includes("boston")) return "/matchup/redsox";
  if (t.includes("yankees")) return "/matchup/yankees";
  if (t.includes("blue jays") || t.includes("toronto")) return "/matchup/bluejays";
  return null;
};
import logo from "@/assets/metsxmfanzone-logo.png";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url: string;
  category: string;
  published_at: string;
}

const SpringTrainingLive = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    // Spring Training is discontinued - redirect all users to plans page
    if (!loading && user) {
      navigate("/plans", { replace: true });
    }
  }, [user, loading, navigate]);

  // Defer blog fetch so stream player loads first
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image_url, category, published_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(3);

      if (data) {
        setBlogPosts(data as BlogPost[]);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Mets 2026 Regular Season Live - Exclusive Coverage | MetsXMFanZone"
        description="Watch Mets 2026 regular season live streams, get game stats, latest news and exclusive coverage."
        canonical="https://www.metsxmfanzone.com/spring-training-live"
        keywords="Mets spring training 2026, spring training live, Mets preseason, Port St. Lucie, Mets training camp, Mets news"
        ogType="video.other"
      />
      <Navigation />

      <main className="flex-1 pt-12">
        {/* Hero Banner - lightweight for TV browsers */}
        <div className="relative overflow-hidden bg-[#00843D]">
          
          <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-[#00843D] to-primary flex items-center justify-center shadow-xl shadow-[#00843D]/20 p-2">
                  <img src={logo} alt="MetsXMFanZone" className="w-full h-full object-contain" />
                </div>
                <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                  <Radio className="w-3 h-3" />
                  LIVE
                </div>
              </div>
              
              <div className="flex-1">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/30">
                      <Sun className="w-3 h-3 mr-1" />
                      2026 Season
                    </Badge>
                    <Badge variant="outline" className="border-white/30 text-white">
                      <Tv className="w-3 h-3 mr-1" />
                      HD Quality
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2">
                    Regular Season <span className="text-primary">Live</span>
                  </h1>
                  <p className="text-white/70 text-sm sm:text-base max-w-xl">
                    Live coverage of Mets 2026 regular season games. 
                    Watch every game with exclusive coverage and real-time stats.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="flex items-center gap-2 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground">Port St. Lucie, FL</span>
                  </div>
                  <div className="flex items-center gap-2 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                    <Clock className="w-4 h-4 text-[#00843D]" />
                    <span className="text-xs text-foreground">Live Coverage</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => window.open("https://facebook.com/metsxmfanzone", "_blank")}
                  >
                    <Facebook className="w-4 h-4" />
                    Follow on Facebook
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate("/mets-roster")}
                  >
                    <Users className="w-4 h-4" />
                    View 2026 Roster
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Player Section */}
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto">
            <div className="stream-player-shell overflow-hidden bg-player sm:rounded-lg">
              <ClapprPlayer
                pageTitle="Regular Season Live Stream"
                pageDescription="Live coverage of Mets games"
              />
            </div>
            
            {/* Channel Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#00843D]/10 flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-[#00843D]" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Game Schedule</h3>
                  <p className="text-sm text-muted-foreground">
                    Full spring training schedule with game times, opponents, and broadcast info.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Roster Updates</h3>
                  <p className="text-sm text-muted-foreground">
                    Track roster moves, prospect performances, and position battles throughout camp.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#FFD700]/10 flex items-center justify-center mb-4">
                    <Sun className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Florida Coverage</h3>
                  <p className="text-sm text-muted-foreground">
                    Exclusive content from Clover Park including interviews, workouts, and fan events.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Latest Mets News */}
        <section className="py-12 bg-secondary/20">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2 mb-8">
                <TrendingUp className="w-8 h-8 text-primary" />
                <h2 className="text-3xl font-bold">Latest Mets News</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogPosts.map((post) => (
                  <Card
                    key={post.id}
                    className="border-2 border-primary bg-card overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/blog/${post.slug}`)}
                  >
                    {post.featured_image_url && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.featured_image_url}
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <Badge className="w-fit mb-2 bg-primary text-primary-foreground">{post.category}</Badge>
                      <CardTitle className="line-clamp-2 text-lg">
                        {post.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mets RSS Feed Section */}
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-8 h-8 text-primary" />
                <h2 className="text-3xl font-bold">Mets News Feed</h2>
              </div>

              <MetsRSSFeed />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default SpringTrainingLive;