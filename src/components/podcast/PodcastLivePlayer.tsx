import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Square, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import podcastLogo from "@/assets/podcast-logo.png";

export type PodcastLive = {
  id: string;
  title: string | null;
  description: string | null;
  is_live: boolean;
  vdo_ninja_url: string | null;
  updated_at?: string | null;
};

/** Live status of the MetsXMFanZone podcast. Realtime plus a 20s poll as a backup. */
export function usePodcastLive() {
  const [live, setLive] = useState<PodcastLive | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("podcast_live_stream")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLive((data as PodcastLive) ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const poll = window.setInterval(load, 20_000);
    const channel = supabase
      .channel("podcast-live-player")
      .on("postgres_changes", { event: "*", schema: "public", table: "podcast_live_stream" }, (payload) => {
        if (payload.new && Object.keys(payload.new).length) setLive(payload.new as PodcastLive);
      })
      .subscribe();
    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { live, loaded, isLive: !!live?.is_live };
}

const Equalizer = ({ active }: { active: boolean }) => (
  <span className="flex h-8 items-end gap-[3px]" aria-hidden="true">
    {[0.5, 1, 0.65, 0.9, 0.45, 0.8, 0.55].map((h, i) => (
      <span
        key={i}
        className="w-[4px] rounded-full bg-primary"
        style={{
          height: active ? undefined : `${h * 30}%`,
          animation: active ? `mxEqLive ${0.7 + i * 0.1}s ease-in-out ${i * 0.07}s infinite alternate` : undefined,
        }}
      />
    ))}
  </span>
);

/** Build a listen-only view URL from the stored VDO.Ninja link. */
const listenUrl = (url: string) => {
  let u = url;
  if (!u.includes("autostart")) u += (u.includes("?") ? "&" : "?") + "autostart";
  if (!u.includes("cleanoutput")) u += "&cleanoutput";
  if (!u.includes("novideo")) u += "&novideo";
  return u;
};

const PodcastLivePlayer = () => {
  const { live, loaded, isLive } = usePodcastLive();
  const [listening, setListening] = useState(false);
  const wasLive = useRef(false);

  // When the show ends, stop listening so the next show starts fresh.
  useEffect(() => {
    if (wasLive.current && !isLive) setListening(false);
    wasLive.current = isLive;
  }, [isLive]);

  const canListen = isLive && !!live?.vdo_ninja_url;

  return (
    <section aria-labelledby="podcast-live-title" className="py-6 sm:py-8">
      <style>{`@keyframes mxEqLive{from{height:20%}to{height:100%}}`}</style>
      <div className="mb-4">
        <p className="mx-eyebrow mb-1.5 !text-primary">MetsXMFanZone Podcast</p>
        <h2 id="podcast-live-title" className="font-display text-[30px] uppercase leading-none tracking-wide text-foreground sm:text-4xl">
          Live player
        </h2>
      </div>

      <div className={`relative overflow-hidden rounded-3xl border p-5 shadow-xl sm:p-8 ${isLive ? "border-red-500/50" : "border-white/15"} bg-[linear-gradient(135deg,#0a2a52_0%,#07182e_60%,#05101d_100%)]`}>
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <img src={podcastLogo} alt="MetsXMFanZone Podcast" width={180} height={153} className="h-auto w-[130px] shrink-0 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:w-[180px]" />

          <div className="min-w-0 flex-1">
            {!loaded ? (
              <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
            ) : isLive ? (
              <span className="inline-flex items-center gap-2 rounded bg-red-700 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white" role="status">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE NOW
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded bg-white/10 px-2.5 py-1 text-[11px] font-extrabold tracking-[0.12em] text-white/70" role="status">
                <span className="h-1.5 w-1.5 rounded-full bg-white/50" /> OFFLINE
              </span>
            )}

            <h3 className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              {isLive ? live?.title || "MetsXMFanZone Podcast live" : "We're offline right now"}
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
              {isLive
                ? live?.description || "Tap listen to hear the show live."
                : "This player lights up as soon as the show goes live. Keep alerts on so you don't miss it."}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              {canListen ? (
                <button
                  type="button"
                  onClick={() => setListening((v) => !v)}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#d43700] px-6 text-base font-bold text-white shadow-lg shadow-black/30 transition-colors hover:bg-[#e04000]"
                >
                  {listening ? <><Square className="h-5 w-5" /> Stop listening</> : <><Headphones className="h-5 w-5" /> Listen live</>}
                </button>
              ) : (
                <span className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white/60">
                  <Bell className="h-4 w-4" /> Not live yet
                </span>
              )}
              <Equalizer active={listening && canListen} />
            </div>
          </div>
        </div>

        {/* Audio-only: the stream plays here but is kept off-screen. */}
        {listening && canListen && (
          <iframe
            title="MetsXMFanZone podcast live audio"
            src={listenUrl(live!.vdo_ninja_url!)}
            allow="autoplay; encrypted-media"
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
        )}
      </div>
    </section>
  );
};

export default PodcastLivePlayer;
