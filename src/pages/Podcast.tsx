import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, ExternalLink, Gift, Headphones, Instagram, Music2, Facebook, Twitter, Youtube, Shirt, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import BlogSection from "@/components/BlogSection";
import PodcastRadioSection from "@/components/PodcastRadioSection";
import PodcastShop from "@/components/podcast/PodcastShop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import podcastLogo from "@/assets/podcast-logo.png";

interface PodcastLiveStream {
  id: string;
  title: string;
  description: string | null;
  is_live: boolean;
}

type Social = { name: string; handle: string; icon: LucideIcon; url: string; bg: string };

const socials: Social[] = [
  { name: "TikTok", handle: "@metsxmfanzone", icon: Music2, url: "https://www.tiktok.com/@metsxmfanzone", bg: "from-[#010101] to-[#1f1f2b]" },
  { name: "YouTube", handle: "@metsxmfanzone", icon: Youtube, url: "https://www.youtube.com/@metsxmfanzone", bg: "from-[#b00000] to-[#e62117]" },
  { name: "Instagram", handle: "@metsxmfanzone", icon: Instagram, url: "https://www.instagram.com/metsxmfanzone", bg: "from-[#6a2cd8] via-[#d62976] to-[#fa7e1e]" },
  { name: "X", handle: "@metsxmfanzone", icon: Twitter, url: "https://twitter.com/metsxmfanzone", bg: "from-[#0a0a0a] to-[#2a2f36]" },
  { name: "Facebook", handle: "/metsxmfanzoneofficial", icon: Facebook, url: "https://www.facebook.com/metsxmfanzoneofficial", bg: "from-[#0d4fbf] to-[#1877f2]" },
];

const MLB_SHOP_URL = "https://mlbshop.ue7a.net/c/4203164/3525756/9676";

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mx-eyebrow mb-1.5 !text-primary">{children}</p>
);

const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="font-display text-[30px] uppercase leading-none tracking-wide text-foreground sm:text-4xl">
    {children}
  </h2>
);

const Podcast = () => {
  const { user } = useAuth();
  const [liveStream, setLiveStream] = useState<PodcastLiveStream | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("podcast_live_stream").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      setLiveStream((data as PodcastLiveStream) ?? null);
    };
    load();
    const channel = supabase
      .channel("podcast-live-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "podcast_live_stream" }, (payload) => {
        if (payload.new) setLiveStream(payload.new as PodcastLiveStream);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const isLive = !!liveStream?.is_live;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="MetsXMFanZone Podcast & Radio"
        description="Listen to the MetsXMFanZone podcast, follow us on TikTok, YouTube, Instagram, X and Facebook, and shop MetsXMFanZone gear."
        keywords="Mets podcast, MetsXMFanZone podcast, Mets radio, Mets fan podcast, Mets TikTok live"
        canonical="https://www.metsxmfanzone.com/podcast"
        pageType="podcast"
      />
      <Navigation />
      <main className="pt-14 md:pt-24">
        {/* ---------- Hero ---------- */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_80%_0%,#0f4f93_0%,#0a2a52_38%,#07111d_100%)]" aria-hidden />
          <div
            className="absolute inset-0 -z-10 opacity-[0.07]"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 14px)", maskImage: "linear-gradient(to bottom,#000,transparent 70%)", WebkitMaskImage: "linear-gradient(to bottom,#000,transparent 70%)" }}
            aria-hidden
          />
          <div className="absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-primary/25 blur-[110px]" aria-hidden />

          <div className="container mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-16">
            <div className="order-2 text-center lg:order-1 lg:text-left">
              {isLive ? (
                <span className="mb-3 inline-flex items-center gap-2 rounded bg-red-700 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE NOW
                </span>
              ) : (
                <p className="mx-eyebrow mb-3 !text-[#ff8a5c] lg:justify-start">Mets talk · News · Live shows</p>
              )}
              <h1 className="mx-wordmark text-[44px] uppercase leading-[0.92] text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
                The Mets Fan <span className="text-primary">Podcast</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-white/75 sm:text-lg lg:mx-0">
                {isLive
                  ? `${liveStream?.title || "We're live right now"}${liveStream?.description ? ` — ${liveStream.description}` : ""}. Tune in on our channels.`
                  : "Join Anthony and the Mets Universe for game talk, news and fan reactions. Listen here or catch us live."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <a href="#episodes" className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#d43700] px-6 text-base font-bold text-white shadow-lg shadow-black/30 transition-colors hover:bg-[#e04000]">
                  <Headphones className="h-5 w-5" /> Listen now
                </a>
                <a href="#follow" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 px-6 text-base font-bold text-white transition-colors hover:bg-white/10">
                  Follow us <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="order-1 flex justify-center lg:order-2">
              <div className="relative">
                <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-primary/30 blur-3xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]" aria-hidden />
                <img src={podcastLogo} alt="MetsXMFanZone Podcast" width={320} height={272} className="h-auto w-[170px] drop-shadow-[0_14px_40px_rgba(0,0,0,0.55)] sm:w-[260px] lg:w-[340px]" />
              </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          {/* ---------- Radio + latest episodes ---------- */}
          <div id="episodes" className="-mx-4 scroll-mt-24 sm:-mx-6 lg:-mx-8">
            <PodcastRadioSection showAllLink={false} />
          </div>

          {/* ---------- Socials ---------- */}
          <section id="follow" aria-labelledby="pod-follow" className="scroll-mt-24 py-8 sm:py-10">
            <div className="mb-5">
              <Eyebrow>Follow &amp; watch live</Eyebrow>
              <SectionTitle id="pod-follow">Find us everywhere</SectionTitle>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {socials.map((s, i) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${s.bg} p-4 text-white shadow-md transition-transform hover:-translate-y-1 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}
                  >
                    <Icon className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />
                    <span>
                      <span className="block text-[17px] font-extrabold leading-tight">{s.name}</span>
                      <span className="block truncate text-[12.5px] text-white/75">{s.handle}</span>
                    </span>
                    <ExternalLink className="absolute right-3 top-3 h-4 w-4 opacity-60" />
                  </a>
                );
              })}
            </div>
          </section>

          {/* ---------- Shop ---------- */}
          <PodcastShop />

          {/* ---------- Sponsors ---------- */}
          <section aria-labelledby="pod-sponsors" className="py-8 sm:py-10">
            <div className="mb-5">
              <Eyebrow>Our partners</Eyebrow>
              <SectionTitle id="pod-sponsors">Sponsors</SectionTitle>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f4f93] to-[#07111d] text-white">
                  <Shirt className="h-8 w-8" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">Apparel partner</p>
                  <h3 className="text-xl font-extrabold leading-tight text-foreground">SPM Apparels</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Proud supporter of the MetsXMFanZone podcast.</p>
                </div>
              </div>

              <a
                href={MLB_SHOP_URL}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 transition-colors hover:border-primary/60 sm:p-5"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0f4f93] to-[#07111d] text-white">
                  <Store className="h-8 w-8" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">Official gear</p>
                  <h3 className="text-xl font-extrabold leading-tight text-foreground">MLB Shop</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Jerseys, hats and Mets gear from Fanatics.</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Some links are affiliate links. MetsXMFanZone may earn a commission at no cost to you.</p>
          </section>

          {/* ---------- Giveaway ---------- */}
          <section aria-labelledby="pod-giveaway" className="py-4 sm:py-6">
            <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-[linear-gradient(135deg,#0a2a52_0%,#07182e_55%,#2a1208_100%)] p-6 text-center sm:p-10">
              <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/30 blur-3xl" aria-hidden />
              <div className="relative mx-auto max-w-xl">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Gift className="h-7 w-7" />
                </span>
                <p className="mx-eyebrow mt-4 !text-[#ff8a5c]">Sweepstakes</p>
                <h2 id="pod-giveaway" className="mx-wordmark mt-1 text-[34px] uppercase leading-none text-white sm:text-5xl">
                  Next giveaway soon
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-white/70 sm:text-base">
                  Our next MetsXMFanZone giveaway is on the way. Join and turn on alerts so you're the first to know when it opens.
                </p>
                {user ? (
                  <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                    <Bell className="h-4 w-4 text-primary" /> Keep alerts on. We'll announce it here and by email.
                  </p>
                ) : (
                  <Link to="/auth?mode=signup" className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-[#d43700] px-6 text-base font-bold text-white hover:bg-[#e04000]">
                    <Bell className="h-5 w-5" /> Join to get notified
                  </Link>
                )}
              </div>
            </div>
          </section>

          {/* ---------- Blog ---------- */}
          <BlogSection />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Podcast;
