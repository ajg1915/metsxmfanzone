import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Radio, Tv, Signal, Clock, MapPin } from "lucide-react";
import { motion } from "framer-motion";

const MSGPlus = () => {
  return (
    <StreamTimeLimit>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title="MSG Plus Live - Watch Mets Baseball Coverage | MetsXMFanZone"
          description="Watch MSG Plus live Mets baseball coverage, pre-game and post-game shows on MetsXMFanZone."
          canonical="https://www.metsxmfanzone.com/msg-plus"
          keywords="MSG Plus, MSG+, MSG Plus live, Mets coverage, live baseball"
          ogType="video.other"
        />
        <Navigation />

        <main className="flex-1 pt-12">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#003DA5] via-[#002D72] to-background">
            <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-[#003DA5] to-[#F4A100] flex items-center justify-center shadow-xl shadow-[#003DA5]/20">
                    <span className="text-white font-black text-2xl sm:text-3xl tracking-tight">
                      MSG+
                    </span>
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

                <div className="flex-1">
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
                    MSG <span className="text-[#F4A100]">Plus</span>
                  </h1>
                  <p className="text-white/70 text-sm sm:text-base max-w-xl">
                    Your alternate MSG feed — additional Mets and NY sports coverage, live and on-demand.
                  </p>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                      <MapPin className="w-4 h-4 text-[#F4A100]" />
                      <span className="text-xs text-foreground">New York</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/50">
                      <Clock className="w-4 h-4 text-[#F4A100]" />
                      <span className="text-xs text-foreground">Game Day Coverage</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-6 sm:py-8">
            <div className="max-w-6xl mx-auto">
              <StreamPlayer
                pageName="msg-plus"
                pageTitle="MSG Plus"
                pageDescription="Watch MSG Plus live Mets baseball coverage"
              />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </StreamTimeLimit>
  );
};

export default MSGPlus;
