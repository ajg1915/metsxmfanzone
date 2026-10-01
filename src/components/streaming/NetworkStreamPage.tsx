import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Signal, Tv } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { StreamPlayer } from "@/components/StreamPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import SEOHead from "@/components/SEOHead";
import SocialLinksSection from "@/components/SocialLinksSection";

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
};

// Every stream channel page links to its siblings so people can flip channels.
const CHANNELS: { label: string; to: string; key: string }[] = [
  { label: "MLB Network", to: "/mlb-network", key: "mlb-network" },
  { label: "ESPN", to: "/espn-network", key: "espn-network" },
  { label: "MSG", to: "/msg-network", key: "msg-network" },
  { label: "MSG+", to: "/msg-plus", key: "msg-plus" },
  { label: "Game Events", to: "/pix11-network", key: "pix11-network" },
  { label: "MetsXMFanZone TV", to: "/metsxmfanzone", key: "metsxmfanzone" },
];

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
          {/* Brand header: sits right above the player */}
          <div className="relative overflow-hidden" style={{ backgroundImage: `linear-gradient(135deg, ${brand.from} 0%, ${brand.to} 55%, hsl(var(--background)) 100%)` }}>
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: brand.accent, opacity: 0.18 }} aria-hidden="true" />
            <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5 sm:py-6">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-center shadow-lg sm:h-24 sm:w-24 sm:rounded-2xl"
                style={{ backgroundImage: `linear-gradient(135deg, ${brand.from}, ${brand.to})`, boxShadow: `0 8px 24px ${brand.accent}33`, border: "1px solid rgba(255,255,255,0.18)" }}
              >
                {cfg.mark}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[30px] font-bold uppercase leading-none tracking-wide text-white sm:text-5xl">
                  {cfg.title} <span style={{ color: brand.accent }}>{cfg.titleAccent}</span>
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Signal className="h-3 w-3" /> {cfg.badges[0]}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white">
                    <Tv className="h-3 w-3" /> {cfg.badges[1]}
                  </span>
                </div>
              </div>
            </div>
          </div>

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

            {/* Channel switcher */}
            <nav aria-label="Switch channel" className="mt-5">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: brand.accent }}>
                Switch channel
              </p>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
                {CHANNELS.map((c) => {
                  const active = c.key === cfg.pageKey;
                  return (
                    <Link
                      key={c.key}
                      to={c.to}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors ${
                        active ? "border-white/40 text-white" : "border-border/60 bg-card text-foreground hover:border-primary/50"
                      }`}
                      style={active ? { background: `linear-gradient(135deg, ${brand.from}, ${brand.to})` } : undefined}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

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
