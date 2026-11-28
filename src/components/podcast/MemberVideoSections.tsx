import { useEffect, useState } from "react";
import { Play, Youtube, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

// "Our YouTube" row that sits under the podcast player.
// Signed-in members only: signed-out visitors never see them.

const YOUTUBE_URL = "https://www.youtube.com/@MetsXMFanZonePodcast";

type YtVideo = { id: string; title: string; published: string | null; thumbnail: string };
type Playing = { id: string; title: string } | null;

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useJson<T>(url: string, key: string) {
  const [data, setData] = useState<T[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then((r) => r.json())
      .then((j) => live && setData(Array.isArray(j?.[key]) ? j[key] : []))
      .catch(() => live && setData([]));
    return () => { live = false; };
  }, [url, key]);
  return data;
}

function SectionHeader({ icon, title, href, label }: { icon: React.ReactNode; title: string; href: string; label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
        {icon} {title}
      </h2>
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
        {label} <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Player({ playing, onClose }: { playing: NonNullable<Playing>; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const src = `https://www.youtube-nocookie.com/embed/${playing.id}?autoplay=1&rel=0&playsinline=1`;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={playing.title}>
      <button onClick={onClose} aria-label="Close video" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="aspect-video w-full max-w-4xl">
        <iframe
          src={src}
          title={playing.title}
          className="h-full w-full rounded-xl border-0 bg-black"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function Thumb({ img, title, meta, badge, tall, onClick }: { img: string; title: string; meta: string; badge: React.ReactNode; tall?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group overflow-hidden rounded-xl border border-border/50 bg-background/40 text-left transition-colors hover:border-primary/60">
      <div className={`relative overflow-hidden bg-[#0d1b30] ${tall ? "aspect-[3/4]" : "aspect-video"}`}>
        {img ? (
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ff0050]/30 to-[#00f2ea]/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute left-2 top-2">{badge}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5 fill-black text-black" />
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{title}</p>
        {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
      </div>
    </button>
  );
}

export default function MemberVideoSections({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <Sections className={className} />;
}

function Sections({ className }: { className: string }) {
  const youtube = useJson<YtVideo>("/api/youtube-feed", "videos");
  const [playing, setPlaying] = useState<Playing>(null);

  const grid = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6";
  const skeleton = (tall: boolean) => (
    <div className={grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className={`${tall ? "aspect-[3/4]" : "aspect-video"} rounded-xl`} />
      ))}
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <section aria-label="Our YouTube videos" className="rounded-2xl border border-border/60 bg-card/70 p-3 sm:p-4">
        <SectionHeader icon={<Youtube className="h-5 w-5 text-primary" />} title="Our YouTube" href={YOUTUBE_URL} label="Subscribe" />
        {youtube === null ? (
          skeleton(false)
        ) : youtube.length === 0 ? (
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-border/50 p-6 text-center text-sm text-muted-foreground hover:border-primary/60">
            Watch the latest shows on our YouTube channel <span className="font-bold text-primary">→</span>
          </a>
        ) : (
          <div className={grid}>
            {youtube.slice(0, 6).map((v) => (
              <Thumb
                key={v.id}
                img={v.thumbnail}
                title={v.title}
                meta={timeAgo(v.published)}
                badge={<span className="rounded-full bg-[#ff0000] px-2 py-0.5 text-[10px] font-bold text-white">YouTube</span>}
                onClick={() => setPlaying({ id: v.id, title: v.title })}
              />
            ))}
          </div>
        )}
      </section>

      {playing && <Player playing={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
