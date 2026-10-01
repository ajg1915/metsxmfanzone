import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Pause, Play, Radio, RotateCcw, RotateCw } from "lucide-react";
import { downloadAudio } from "@/utils/downloadAudio";
import { supabase } from "@/integrations/supabase/client";
import podcastLogo from "@/assets/podcast-logo.png";

type Episode = {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  published_at: string | null;
  duration: number | null;
};

type LiveShow = { is_live: boolean; title: string | null } | null;

const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

const Equalizer = ({ active }: { active: boolean }) => (
  <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
    {[0.5, 1, 0.65, 0.9, 0.45].map((h, i) => (
      <span
        key={i}
        className="w-[3px] rounded-full bg-primary"
        style={{
          height: active ? undefined : `${h * 40}%`,
          animation: active ? `mxEq ${0.7 + i * 0.12}s ease-in-out ${i * 0.08}s infinite alternate` : undefined,
        }}
      />
    ))}
  </span>
);

const PodcastRadioSection = () => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [live, setLive] = useState<LiveShow>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eps, ls] = await Promise.all([
        supabase
          .from("podcasts")
          .select("id, title, description, audio_url, published_at, duration")
          .eq("published", true)
          .order("published_at", { ascending: false })
          .limit(8),
        supabase.from("podcast_live_stream").select("is_live, title").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      if (eps.data) setEpisodes(eps.data as Episode[]);
      if (ls.data) setLive(ls.data as LiveShow);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(() => episodes.find((e) => e.id === activeId) ?? episodes[0] ?? null, [episodes, activeId]);

  const load = useCallback((ep: Episode, autoplay: boolean) => {
    const a = audioRef.current;
    if (!a) return;
    setError(false);
    setActiveId(ep.id);
    setCurrent(0);
    setDuration(ep.duration ?? 0);
    a.src = ep.audio_url;
    if (autoplay) a.play().catch(() => setError(true));
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !active) return;
    if (activeId !== active.id || !a.src) {
      load(active, true);
      return;
    }
    if (a.paused) a.play().catch(() => setError(true));
    else a.pause();
  };

  const skip = (sec: number) => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    a.currentTime = Math.max(0, Math.min(a.duration || Infinity, a.currentTime + sec));
  };

  // Lock-screen / headset controls
  useEffect(() => {
    if (!active || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: active.title,
      artist: "MetsXMFanZone Podcast",
      artwork: [{ src: podcastLogo, sizes: "512x512", type: "image/png" }],
    });
  }, [active]);

  if (!loaded || (episodes.length === 0 && !live?.is_live)) return null;

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <section aria-labelledby="podcast-radio-title" className="relative py-6 sm:py-8">
      <style>{`@keyframes mxEq{from{height:25%}to{height:100%}}`}</style>
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-2">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
              <span className="h-0.5 w-4 bg-primary" /> <span className="whitespace-nowrap">MetsXMFanZone Radio</span>
            </p>
            <h2 id="podcast-radio-title" className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-3xl">
              The Podcast
            </h2>
          </div>
          <Link to="/podcast" className="flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary hover:text-primary/80">
            All episodes <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {live?.is_live && (
          <Link
            to="/podcast"
            className="mb-3 flex min-h-[52px] items-center gap-3 rounded-xl border border-red-500/50 bg-red-600/15 px-4 py-2 text-foreground"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-red-400">Live now</span>
              <span className="block truncate text-[15px] font-bold">{live.title || "MetsXMFanZone Podcast live show"}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-bold text-red-300">
              Watch <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          {/* Radio player */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[linear-gradient(135deg,#0a2a52_0%,#07182e_60%,#05101d_100%)] p-4 shadow-xl sm:p-6">
            {/* Dial ticks */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-3 opacity-40"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.7) 0 1px, transparent 1px 10px)", maskImage: "linear-gradient(to bottom, #000, transparent)" }}
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />

            <div className="relative flex items-center gap-4 sm:gap-6">
              <img
                src={podcastLogo}
                alt="MetsXMFanZone Podcast"
                className={`h-auto w-[104px] shrink-0 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:w-[160px] ${playing ? "motion-safe:animate-[pulse_3s_ease-in-out_infinite]" : ""}`}
                width={160}
                height={136}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] font-extrabold tracking-[0.1em] ${playing ? "bg-red-700 text-white" : "bg-white/10 text-white/70"}`}>
                    <Radio className="h-3 w-3" /> {playing ? "ON AIR" : "READY"}
                  </span>
                  <Equalizer active={playing} />
                </div>
                <p className="line-clamp-3 text-[17px] font-bold leading-tight text-white sm:text-xl">{active?.title ?? "Latest episode"}</p>
                {active?.published_at && <p className="mt-1 text-[13px] text-white/60">{fmtDate(active.published_at)}</p>}
              </div>
            </div>

            {/* Progress */}
            <div className="relative mt-5">
              <label htmlFor="podcast-seek" className="sr-only">Seek in episode</label>
              <input
                id="podcast-seek"
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(current, duration || 0)}
                disabled={!duration}
                onChange={(e) => {
                  const a = audioRef.current;
                  if (a) a.currentTime = Number(e.target.value);
                  setCurrent(Number(e.target.value));
                }}
                className="h-11 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                style={{ ["--p" as string]: `${progress}%`, background: `linear-gradient(to right, #ff5a1f var(--p), rgba(255,255,255,0.2) var(--p)) center / 100% 6px no-repeat` }}
              />
              <div className="-mt-2 flex justify-between text-xs text-white/60" style={{ fontVariantNumeric: "tabular-nums" }}>
                <span>{fmtTime(current)}</span>
                <span>{duration ? fmtTime(duration) : "--:--"}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="relative mt-2 flex items-center justify-center gap-5">
              <button type="button" onClick={() => skip(-15)} aria-label="Back 15 seconds" className="flex h-12 w-12 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
                <RotateCcw className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play episode"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[#d43700] text-white shadow-lg shadow-black/40 hover:bg-[#e04000] active:scale-95"
              >
                {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}
              </button>
              <button type="button" onClick={() => skip(30)} aria-label="Forward 30 seconds" className="flex h-12 w-12 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
                <RotateCw className="h-6 w-6" />
              </button>
            </div>
            {active && (
              <button
                type="button"
                onClick={() => downloadAudio(active.audio_url, active.title)}
                className="relative mx-auto mt-3 flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                <Download className="h-4 w-4" /> Download episode
              </button>
            )}
            {error && <p role="alert" className="relative mt-2 text-center text-sm text-red-300">Couldn't play that episode. Tap play to try again.</p>}
          </div>

          {/* Episode list */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-2 sm:p-3">
            <p className="px-2 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Episodes</p>
            <ul className="max-h-[420px] divide-y divide-border/30 overflow-y-auto lg:max-h-[360px]">
              {episodes.map((ep, i) => {
                const isActive = ep.id === active?.id;
                return (
                  <li key={ep.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => (isActive ? toggle() : load(ep, true))}
                      aria-label={`${isActive && playing ? "Pause" : "Play"} ${ep.title}`}
                      className={`flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${isActive ? "bg-primary/10" : "hover:bg-muted/30"}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-[#d43700] text-white" : "bg-muted/40 text-foreground"}`}>
                        {isActive && playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block line-clamp-2 text-[15px] font-semibold leading-tight text-foreground">{ep.title}</span>
                        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                          {fmtDate(ep.published_at)}
                          {ep.duration ? ` · ${fmtTime(ep.duration)}` : ""}
                        </span>
                      </span>
                      {isActive && <Equalizer active={playing} />}
                      <span className="sr-only">Episode {episodes.length - i}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadAudio(ep.audio_url, ep.title)}
                      aria-label={`Download ${ep.title}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <audio
          ref={audioRef}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            const idx = episodes.findIndex((e) => e.id === activeId);
            if (idx >= 0 && idx < episodes.length - 1) load(episodes[idx + 1], true);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => { setPlaying(false); setError(true); }}
        />
      </div>
    </section>
  );
};

export default PodcastRadioSection;
