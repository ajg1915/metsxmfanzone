import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Pause, Music2, Facebook, Headphones, Music, Podcast, Radio, Mic, ArrowRight, Waves, Volume2, Disc3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/metsxmfanzone-logo.png";
import PremiumBadge from "@/components/PremiumBadge";
import { useSubscription } from "@/hooks/useSubscription";
import { motion } from "framer-motion";

interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  published_at: string;
}

const platforms = [
  { name: "TikTok", icon: Music2, url: "https://www.tiktok.com/@metsxmfanzone" },
  { name: "Facebook", icon: Facebook, url: "https://www.facebook.com/metsxmfanzone" },
  { name: "iHeartRadio", icon: Radio, url: "https://www.iheart.com" },
  { name: "Amazon Music", icon: Headphones, url: "https://music.amazon.com" },
  { name: "Spotify", icon: Music, url: "https://open.spotify.com" },
  { name: "Apple Podcasts", icon: Podcast, url: "https://podcasts.apple.com" },
];

const EqualizerBars = ({ animate = true }: { animate?: boolean }) => (
  <div className="flex items-end gap-[3px] h-5">
    {[0.6, 1, 0.4, 0.8, 0.5, 0.9, 0.3].map((height, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-[hsl(var(--mets-orange))]"
        initial={{ height: `${height * 100}%` }}
        animate={animate ? {
          height: [`${height * 40}%`, `${height * 100}%`, `${height * 60}%`, `${height * 90}%`, `${height * 40}%`],
        } : {}}
        transition={{
          duration: 1.2 + i * 0.15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

const PodcastSection = () => {
  const { tier, isAdmin } = useSubscription();
  const [podcasts, setPodcasts] = useState<PodcastEpisode[]>([]);
  const isPremium = isAdmin || tier === "weekly" || tier === "premium" || tier === "annual";

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const fetchPodcasts = async () => {
    const { data } = await supabase
      .from("podcasts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(3);
    if (data) setPodcasts(data);
  };

  return (
    <section className="py-10 sm:py-20 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[hsl(var(--mets-blue)/0.06)] blur-[150px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[hsl(var(--mets-orange)/0.04)] blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10 sm:mb-16"
        >
          {/* Logo + Title */}
          <div className="flex flex-col items-center gap-4 mb-5">
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-2xl bg-[hsl(var(--mets-orange)/0.4)] blur-xl"
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card/90 backdrop-blur-xl border border-border/30 flex items-center justify-center shadow-lg">
                <img src={logo} alt="MetsXMFanZone" className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground">
                MetsXM<span className="text-[hsl(var(--mets-orange))]">FanZone</span> Radio
              </h2>
              {!isPremium && <PremiumBadge size="xs" noGlow />}
            </div>
          </div>

          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Exclusive Mets content, game analysis & live coverage all season long
          </p>
        </motion.div>

        {/* NOW LIVE Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-10 sm:mb-14"
        >
          <div className="relative rounded-2xl overflow-hidden border border-[hsl(var(--mets-orange)/0.3)] bg-gradient-to-r from-card/80 via-card/60 to-card/80 backdrop-blur-xl">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--mets-orange))] to-transparent" />
            
            {/* Glow behind */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-60 h-20 bg-[hsl(var(--mets-orange)/0.15)] blur-3xl rounded-full" />
            
            <div className="relative flex items-center gap-4 p-5 sm:p-6">
              {/* Animated disc */}
              <div className="relative flex-shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[hsl(var(--mets-orange))] to-[hsl(var(--mets-orange-light))] flex items-center justify-center shadow-lg shadow-[hsl(var(--mets-orange)/0.3)]"
                >
                  <div className="w-4 h-4 rounded-full bg-card" />
                </motion.div>
                <motion.span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-card"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">On Air</span>
                  <EqualizerBars />
                </div>
                <p className="text-sm sm:text-base font-semibold text-foreground">
                  New episodes drop instantly when we go live!
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Follow on any platform to get notified the moment a new episode is available.
                </p>
              </div>

              <Volume2 className="w-6 h-6 text-muted-foreground/40 hidden sm:block" />
            </div>
          </div>
        </motion.div>

        {/* Platforms Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12 sm:mb-16"
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-border/50" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Listen On
            </span>
            <div className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-border/50" />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3 max-w-3xl mx-auto">
            {platforms.map((platform, i) => {
              const IconComponent = platform.icon;
              return (
                <motion.a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.05 * i }}
                  whileHover={{ y: -4, scale: 1.03 }}
                  className="group flex flex-col items-center gap-2 p-3.5 sm:p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/10 hover:border-[hsl(var(--mets-orange)/0.4)] hover:bg-card/80 transition-colors duration-300 hover:shadow-lg hover:shadow-[hsl(var(--mets-orange)/0.08)]"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted/30 flex items-center justify-center group-hover:bg-[hsl(var(--mets-orange)/0.15)] transition-colors">
                    <IconComponent className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-[hsl(var(--mets-orange))] transition-colors" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {platform.name}
                  </span>
                </motion.a>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Episodes */}
        {podcasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-border/50" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
                Recent Episodes
              </span>
              <div className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-border/50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {podcasts.map((podcast, index) => (
                <motion.div
                  key={podcast.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="group relative rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm border border-border/10 hover:border-[hsl(var(--mets-blue)/0.4)] transition-all duration-300 hover:shadow-xl hover:shadow-[hsl(var(--mets-blue)/0.08)]"
                >
                  {/* Episode number badge */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-[hsl(var(--mets-blue)/0.15)] flex items-center justify-center">
                    <span className="text-xs font-bold text-[hsl(var(--mets-blue-light))]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {index === 0 && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[hsl(var(--mets-blue))] via-[hsl(var(--mets-orange))] to-[hsl(var(--mets-blue))]" />
                  )}

                  <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--mets-blue)/0.2)] to-[hsl(var(--mets-blue)/0.05)] flex items-center justify-center flex-shrink-0 group-hover:from-[hsl(var(--mets-blue)/0.3)] group-hover:to-[hsl(var(--mets-blue)/0.1)] transition-all">
                        <Mic className="w-5 h-5 text-[hsl(var(--mets-blue-light))]" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h4 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 text-foreground group-hover:text-[hsl(var(--mets-blue-light))] transition-colors">
                          {podcast.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {podcast.description}
                        </p>
                      </div>
                    </div>

                    <audio
                      controls
                      className="w-full h-9 rounded-lg [&::-webkit-media-controls-panel]:bg-[hsl(var(--muted))] accent-[hsl(var(--mets-orange))] [&::-webkit-media-controls-current-time-display]:text-[hsl(var(--mets-orange))] [&::-webkit-media-controls-time-remaining-display]:text-[hsl(var(--mets-orange))]"
                    >
                      <source src={podcast.audio_url} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center mt-8"
            >
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-xl border-border/30 hover:border-[hsl(var(--mets-orange)/0.5)] hover:bg-[hsl(var(--mets-orange)/0.08)] gap-2 group"
              >
                <Link to="/podcast">
                  View All Episodes
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default PodcastSection;
