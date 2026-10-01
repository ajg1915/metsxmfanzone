import type { ComponentType, CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { Signal, Tv } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import SocialLinksSection from "@/components/SocialLinksSection";
import { ChannelSwitcher, StreamBrandHeader } from "@/components/streaming/StreamChrome";
import TVGuide from "@/components/TVGuide";

type Feature = { icon: ComponentType<{ className?: string; style?: CSSProperties }>; title: string; text: string };

export type NetworkPageConfig = {
  pageKey: string; // also the StreamPlayer page name
  route: string;
  seo: { title: string; description: string; keywords: string };
  /** brand colours: gradient start / end and the accent used for chips and icons */
  brand: { from: string; to: string; accent: string };
  mark: ReactNode; // content of the small logo tile
  title: string;
  titleAccent: string;
  tagline: string;
  badges: [string, string];
  facts: string[];
  features: Feature[];
  player: { title: string; description: string };
  /** optional block rendered between the player facts and the channel switcher */
  extra?: ReactNode;
};

const NetworkStreamPage = ({ cfg }: { cfg: NetworkPageConfig }) => {
  const { brand } = cfg;
  return (
    <StreamTimeLimit pageKey={cfg.pageKey} allowGuestPreview>
      <div className="flex min-h-screen flex-col bg-background">
        <SEOHead
          title={cfg.seo.title}
          description={cfg.seo.description}
          canonical={`https://www.metsxmfanzone.com${cfg.route}`}
          keywords={cfg.seo.keywords}
          ogType="video.other"
        />
        <Navigation />

        <main className="flex-1 pt-14 max-md:pb-24 sm:pt-16">
          <StreamBrandHeader
            brand={brand}
            mark={cfg.mark}
            title={cfg.title}
            titleAccent={cfg.titleAccent}
            badges={[<><Signal className="h-3 w-3" /> {cfg.badges[0]}</>, <><Tv className="h-3 w-3" /> {cfg.badges[1]}</>]}
          />

          {/* Player: edge to edge on phones */}
          <div className="container mx-auto max-w-6xl px-0 sm:px-4 sm:pt-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="bg-player sm:overflow-hidden sm:rounded-xl">
              <StreamPlayer pageName={cfg.pageKey} pageTitle={cfg.player.title} pageDescription={cfg.player.description} />
            </motion.div>
          </div>

          <div className="container mx-auto max-w-6xl px-4 pt-4">
            <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">{cfg.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {cfg.facts.map((f) => (
                <span key={f} className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground">
                  {f}
                </span>
              ))}
            </div>

            {cfg.extra}

            <TVGuide className="mt-6" />

            <ChannelSwitcher activeKey={cfg.pageKey} brand={brand} />

            {/* What's on this channel */}
            {cfg.features.length > 0 && (
              <section aria-label="On this channel" className="mt-6">
                <h2 className="mb-3 font-display text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-3xl">On this channel</h2>
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
                  {cfg.features.map(({ icon: Icon, title, text }) => (
                    <div key={title} className="w-[78vw] max-w-[320px] shrink-0 snap-start rounded-2xl border border-border/50 bg-card/80 p-4 md:w-auto md:max-w-none">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${brand.accent}22` }}>
                        <Icon className="h-5 w-5" style={{ color: brand.accent }} />
                      </div>
                      <h3 className="mb-1 text-lg font-bold text-foreground">{title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          <SocialLinksSection />
        </main>

        <Footer />
      </div>
    </StreamTimeLimit>
  );
};

export default NetworkStreamPage;
