import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Tv, Signal, Clock, MapPin, Trophy, BarChart3, Video } from "lucide-react";
import { motion } from "framer-motion";

const MLBNetwork = () => {
  return (
    <StreamTimeLimit pageKey="mlb-network" allowGuestPreview>
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="MLB Network Live - Watch Baseball Games & Analysis | MetsXMFanZone"
        description="Watch MLB Network live games, highlights, and expert baseball analysis. Stream 24/7 MLB coverage featuring your favorite teams."
        canonical="https://www.metsxmfanzone.com/mlb-network"
        keywords="MLB Network, live baseball, MLB live stream, baseball games live, MLB analysis, baseball coverage"
        ogType="video.other"
      />
      <Navigation />
      
      <main className="flex-1 pt-12">
        {/* Hero Banner with MLB Network Branding */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#041E42] via-[#0a2d5c] to-background">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -top-20 -right-20 w-96 h-96 bg-[#BF0D3E]/10 rounded-full blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#041E42]/30 rounded-full blur-3xl"
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            {/* Animated scan lines */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(191,13,62,0.02)_50%)] bg-[length:100%_4px] pointer-events-none" />
          </div>
          
          <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* MLB Network Logo/Branding */}
              <motion.div 
                className="relative"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-[#041E42] to-[#BF0D3E] flex items-center justify-center shadow-xl shadow-[#BF0D3E]/20">
                  <div className="text-center">
                    <span className="text-white font-black text-2xl sm:text-3xl tracking-tight block">MLB</span>
                    <span className="text-[#BF0D3E] font-bold text-xs sm:text-sm bg-white px-2 py-0.5 rounded">NETWORK</span>
                  </div>
                </div>
                {/* Live indicator */}
                <motion.div 
                  className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Radio className="w-3 h-3" />
                  LIVE
                </motion.div>
              </motion.div>
              
              {/* Title and Info */}
              <div className="flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-[#BF0D3E]/20 text-[#BF0D3E] border-[#BF0D3E]/30">
                      <Signal className="w-3 h-3 mr-1" />
                      Official MLB
                    </Badge>
                    <Badge variant="outline" className="border-muted-foreground/30">
                      <Tv className="w-3 h-3 mr-1" />
                      HD Quality
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2">
                    MLB <span className="text-[#BF0D3E]">Network</span>
                  </h1>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
                    Your 24/7 destination for live baseball coverage, expert analysis, 
                    and exclusive content from across Major League Baseball.
                  </p>
                </motion.div>
                
                {/* Quick Info Cards */}
                <motion.div 
                  className="flex flex-wrap gap-3 mt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                    <MapPin className="w-4 h-4 text-[#BF0D3E]" />
                    <span className="text-xs text-foreground">Nationwide</span>
                  </div>
                  <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                    <Clock className="w-4 h-4 text-[#BF0D3E]" />
                    <span className="text-xs text-foreground">24/7 Coverage</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Player Section */}
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <StreamPlayer 
                pageName="mlb-network"
                pageTitle="MLB Network Live"
                pageDescription="Watch live baseball games and expert analysis"
              />
            </motion.div>
            
            {/* Channel Info Cards */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#BF0D3E]/50 transition-colors group">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#BF0D3E]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Trophy className="w-6 h-6 text-[#BF0D3E]" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Live Games</h3>
                  <p className="text-sm text-muted-foreground">
                    Watch live baseball games from across Major League Baseball with expert commentary.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#041E42]/50 transition-colors group">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#041E42]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-6 h-6 text-[#041E42]" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Expert Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    In-depth analysis from former players and baseball experts breaking down every game.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#BF0D3E]/50 transition-colors group">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#BF0D3E]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Video className="w-6 h-6 text-[#BF0D3E]" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Highlights</h3>
                  <p className="text-sm text-muted-foreground">
                    Catch all the best plays, home runs, and defensive gems from around the league.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
    </StreamTimeLimit>
  );
};

export default MLBNetwork;