import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Play, Sparkles, X, Youtube } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NewBadge from "@/components/NewBadge";
import { isFresh } from "@/lib/newItem";
import logo from "@/assets/metsxmfanzone-logo.png";

// "Our YouTube" section under the podcast player, styled like the other homepage
// sections (same header, featured card and card grid as Our Desk).
// Signed-in members only: signed-out visitors never see it.

const YOUTUBE_URL = "https://www.youtube.com/@MetsXMFanZonePodcast";

type YtVideo = { id: string; title: string; published: string | null; thumbnail: string };

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 day ago";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
}

// YouTube thumbnail chain: big (maxres) -> standard (hq) -> medium (mq) -> logo.
// A missing maxres comes back as a 120x90 gray box instead of an error, so check the size too.
const thumbChain = (id: string, first?: string) =>
  [first, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, logo].filter(Boolean) as string[];

function VideoThumb({ id, first, alt, className, lazy = true }: { id: string; first?: string; alt: string; className: string; lazy?: boolean }) {
  const chain = thumbChain(id, first);
  const [i, setI] = useState(0);
  const next = () => setI((n) => Math.min(n + 1, chain.length - 1));
  const isLogo = chain[i] === logo;
  return (
    <img
      src={chain[i]}
      alt={alt}
      loading={lazy ? "lazy" : undefined}
      className={isLogo ? `${className} !object-contain bg-[#0d1b30] p-6` : className}
      onError={next}
      onLoad={(e) => { if (!isLogo && e.currentTarget.naturalWidth <= 120) next(); }}
    />
  );
}

function Player({ video, onClose }: { video: YtVideo; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={video.title}>
      <button onClick={onClose} aria-label="Close video" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="aspect-video w-full max-w-4xl">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
          title={video.title}
          className="h-full w-full rounded-xl border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}

const PlayDot = ({ big = false }: { big?: boolean }) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <span className={`flex items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110 ${big ? "h-14 w-14" : "h-8 w-8 md:h-11 md:w-11"}`}>
      <Play className={`ml-0.5 fill-black text-black ${big ? "h-6 w-6" : "h-4 w-4 md:h-5 md:w-5"}`} />
    </span>
  </div>
);

export default function MemberVideoSections({ inContainer = false }: { inContainer?: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  return <YouTubeSection inContainer={inContainer} />;
}

function YouTubeSection({ inContainer }: { inContainer: boolean }) {
  const [videos, setVideos] = useState<YtVideo[] | null>(null);
  const [playing, setPlaying] = useState<YtVideo | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/youtube-feed")
      .then((r) => r.json())
      .then((j) => live && setVideos(Array.isArray(j?.videos) ? j.videos : []))
      .catch(() => live && setVideos([]));
    return () => { live = false; };
  }, []);

  const wrap = inContainer ? "relative z-10" : "container relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

  if (videos === null) {
    return (
      <section className="relative py-6 sm:py-12">
        <div className={wrap}>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading latest videos...
          </div>
        </div>
      </section>
    );
  }

  const [featured, ...rest] = videos;
  const others = rest.slice(0, 6);
  const meta = (v: YtVideo) => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">{timeAgo(v.published)}</span>
    </div>
  );
  const openChannel = () => window.open(YOUTUBE_URL, "_blank", "noopener,noreferrer");

  return (
    <section className="relative overflow-hidden py-6 sm:py-12 md:py-16">
      <div className={wrap}>
        {/* Header: same as Our Desk */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-4 sm:mb-6 md:mb-8"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="glass-card shrink-0 rounded-xl p-1.5 sm:p-2">
                <img src={logo} alt="MetsXMFanZone" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
              </div>
              <h2 className="truncate font-bold uppercase leading-none tracking-wide text-foreground text-[26px] sm:text-2xl md:text-3xl">
                Our YouTube
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openChannel}
              className="group glass-card h-10 shrink-0 border-border/30 px-3 text-sm hover:border-primary/50 sm:h-9"
            >
              View all
              <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </motion.div>

        {!featured ? (
          <button
            type="button"
            onClick={openChannel}
            className="glass-card hover-lift glow-blue block w-full rounded-2xl p-8 text-center text-muted-foreground"
          >
            Watch the latest shows on our YouTube channel <span className="font-bold text-primary">→</span>
          </button>
        ) : (
          <>
            {/* Newest video: big card, title on the picture on phones */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group glass-card hover-lift glow-blue mb-4 cursor-pointer overflow-hidden rounded-2xl"
            >
              <button type="button" onClick={() => setPlaying(featured)} className="block w-full text-left">
                <article className="flex min-w-0 flex-col md:flex-row">
                  <div className="relative aspect-video w-full overflow-hidden bg-card md:w-1/2">
                    <VideoThumb
                      id={featured.id}
                      first={`https://i.ytimg.com/vi/${featured.id}/maxresdefault.jpg`}
                      alt={featured.title}
                      lazy={false}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-card/40" />
                    <PlayDot big />
                    <div className="absolute left-3 top-3">
                      <Badge className="border-0 bg-primary px-2 py-0.5 text-xs text-primary-foreground shadow-lg">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Latest
                      </Badge>
                    </div>
                    {isFresh(featured.published) && <NewBadge kind="upload" className="absolute right-3 top-3" />}
                    <div className="absolute inset-x-0 bottom-0 min-w-0 p-3.5 md:hidden">
                      <h3 className="line-clamp-3 break-words text-[22px] font-bold leading-[1.1] text-white drop-shadow-lg [overflow-wrap:anywhere]">
                        {featured.title}
                      </h3>
                    </div>
                  </div>

                  <div className="hidden min-w-0 flex-1 flex-col justify-center p-6 md:flex">
                    <Badge className="mb-3 w-fit border-0 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <Youtube className="mr-1 h-3 w-3" /> YouTube
                    </Badge>
                    <h3 className="mb-3 line-clamp-3 break-words text-2xl font-bold text-foreground transition-colors group-hover:text-primary [overflow-wrap:anywhere]">
                      {featured.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {meta(featured)}
                      <span className="flex items-center gap-1 font-medium text-primary">
                        Watch now <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/20 px-3.5 py-3 md:hidden">
                    {meta(featured)}
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                      Watch <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </article>
              </button>
            </motion.div>

            {/* More videos: compact rows on phones, picture cards from tablet up */}
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {others.map((v, index) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="group glass-card hover-lift glow-blue min-w-0 cursor-pointer overflow-hidden rounded-xl"
                >
                  <button type="button" onClick={() => setPlaying(v)} className="block w-full text-left">
                    <article className="flex min-w-0 items-stretch gap-3 p-2.5 md:flex-col md:gap-0 md:p-0">
                      <div className="relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-card md:aspect-video md:h-auto md:w-full md:rounded-none">
                        <VideoThumb id={v.id} first={v.thumbnail} alt={v.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <PlayDot />
                        {isFresh(v.published) && <NewBadge kind="upload" small className="absolute left-1 top-1" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5 md:p-3.5">
                        <h3 className="line-clamp-3 break-words text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary [overflow-wrap:anywhere]">
                          {v.title}
                        </h3>
                        {meta(v)}
                      </div>
                    </article>
                  </button>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Phones: one big, easy-to-tap button at the bottom */}
        <Button
          variant="outline"
          onClick={openChannel}
          className="glass-card mt-4 h-12 w-full border-primary/40 text-base font-medium sm:hidden"
        >
          Watch all on YouTube
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}
