import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Tv, Signal, Clock, MapPin, Trophy, Users, Star } from "lucide-react";
import { motion } from "framer-motion";

const MSGNetwork = () => {
  return (
    <StreamTimeLimit pageKey="msg-network" allowGuestPreview>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title="MSG Network Live - Watch Mets Baseball Coverage | MetsXMFanZone"
          description="Watch MSG Network live Mets baseball coverage, pre-game and post-game shows, and exclusive behind-the-scenes content. Stream MSG Network on MetsXMFanZone."
          canonical="https://www.metsxmfanzone.com/msg-network"
          keywords="MSG network, MSG baseball, MSG live stream, Mets coverage, New York sports, live baseball, MSG sports"
          ogType="video.other"
        />
        <Navigation />

        <main className="flex-1 pt-12">
          {/* Hero Banner with MSG Branding */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#003DA5] via-[#002D72] to-background">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-20 -right-20 w-96 h-96 bg-[#F4A100]/10 rounded-full blur-3xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#003DA5]/20 rounded-full blur-3xl"
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(244,161,0,0.02)_50%)] bg-[length:100%_4px] pointer-events-none" />
            </div>

            <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* MSG Logo/Branding */}
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-[#003DA5] to-[#F4A100] flex items-center justify-center shadow-xl shadow-[#003DA5]/20">
                    <span className="text-white font-black text-2xl sm:text-3xl tracking-tight">MSG</span>
                  </div>
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
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        <Signal className="w-3 h-3 mr-1" />
                        NY Sports
                      </Badge>
                      <Badge variant="outline" className="border-white/30 text-white">
                        <Tv className="w-3 h-3 mr-1" />
                        HD Quality
                      </Badge>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2">
                      MSG <span className="text-[#F4A100]">Network</span>
                    </h1>
                    <p className="text-white/70 text-sm sm:text-base max-w-xl">
                      Your home for New York Mets baseball. Watch live game broadcasts,
                      pre-game and post-game coverage, and exclusive behind-the-scenes content.
                    </p>
                  </motion.div>

                  <motion.div
                    className="flex flex-wrap gap-3 mt-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                      <MapPin className="w-4 h-4 text-[#F4A100]" />
                      <span className="text-xs text-foreground">New York</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                      <Clock className="w-4 h-4 text-[#F4A100]" />
                      <span className="text-xs text-foreground">Game Day Coverage</span>
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
                  pageName="msg-network"
                  pageTitle="MSG Network"
                  pageDescription="Watch MSG Network live Mets baseball coverage"
                />
              </motion.div>

              {/* Channel Info Cards */}
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#003DA5]/50 transition-colors group">
                  <CardContent className="p-4 sm:p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#003DA5]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Trophy className="w-6 h-6 text-[#003DA5]" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-2">Live Game Broadcasts</h3>
                    <p className="text-sm text-muted-foreground">
                      Full live coverage of Mets games with professional play-by-play and color commentary.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#F4A100]/50 transition-colors group">
                  <CardContent className="p-4 sm:p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#F4A100]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-[#F4A100]" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-2">Pre & Post Game</h3>
                    <p className="text-sm text-muted-foreground">
                      In-depth pre-game analysis and post-game breakdowns with expert hosts and analysts.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-[#003DA5]/50 transition-colors group">
                  <CardContent className="p-4 sm:p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#003DA5]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Star className="w-6 h-6 text-[#003DA5]" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-2">Exclusive Content</h3>
                    <p className="text-sm text-muted-foreground">
                      Behind-the-scenes access, player interviews, and exclusive Mets features you won't find anywhere else.
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

export default MSGNetwork;
