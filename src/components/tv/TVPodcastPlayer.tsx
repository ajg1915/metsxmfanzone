import { useEffect, useRef, useState } from "react";
import { Headphones, Square, Bell } from "lucide-react";
import { usePodcastLive } from "@/components/podcast/PodcastLivePlayer";
import podcastLogo from "@/assets/podcast-logo.png";
import RadioAudio from "@/components/podcast/RadioAudio";
import { useRadioStatus } from "@/lib/podcastRadio";

const listenUrl = (url: string) => {
  let u = url;
  if (!u.includes("autostart")) u += (u.includes("?") ? "&" : "?") + "autostart";
  if (!u.includes("cleanoutput")) u += "&cleanoutput";
  if (!u.includes("novideo")) u += "&novideo";
  return u;
};

// MetsXMFanZone podcast radio for the TV: live or offline status and a remote-friendly Listen button.
export function TVPodcastPlayer() {
  const { live, loaded, isLive } = usePodcastLive();
  const radio = useRadioStatus();
  const [listening, setListening] = useState(false);
  const wasLive = useRef(false);

  useEffect(() => {
    if (wasLive.current && !isLive) setListening(false);
    wasLive.current = isLive;
  }, [isLive]);

  const canListen = isLive && (radio.live || !!live?.vdo_ninja_url);

  return (
    <section id="tv-sec-podcast" aria-label="MetsXMFanZone Podcast" className="mt-[2.4vh]">
      <div className="mb-[1vh] flex items-center gap-3 pl-[0.2vw]">
        <span aria-hidden="true" className="h-[1.2rem] w-[4px] rounded-full bg-[color:var(--tv-accent)]" />
        <h2 className="text-[1.35rem] font-bold text-[color:var(--tv-text)]">MetsXMFanZone Podcast Radio</h2>
      </div>
      <div className={`relative flex items-center gap-[2vw] overflow-hidden rounded-[0.8rem] border px-[2vw] py-[2vh] bg-[linear-gradient(135deg,#0b3e75_0%,#0c1b2c_100%)] ${isLive ? "border-[#e11d48]/60" : "border-white/10"}`}>
        <img src={podcastLogo} alt="" className="h-[11vh] w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          {!loaded ? (
            <span className="text-[0.9rem] text-[color:var(--tv-subtext)]">Checking the show…</span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-2 rounded bg-[#e11d48] px-2.5 py-0.5 text-[0.8rem] font-bold tracking-wider text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE NOW
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded bg-white/10 px-2.5 py-0.5 text-[0.8rem] font-bold tracking-wider text-white/70">
              <span className="h-2 w-2 rounded-full bg-white/50" /> OFFLINE
            </span>
          )}
          <p className="mt-[0.8vh] text-[1.25rem] font-bold leading-tight text-white line-clamp-1">
            {isLive ? live?.title || "MetsXMFanZone Podcast live" : "We're offline right now"}
          </p>
          <p className="mt-[0.3vh] text-[0.95rem] leading-snug text-[color:var(--tv-subtext)] line-clamp-2">
            {isLive ? live?.description || "Press OK to listen live." : "This lights up as soon as the show goes live."}
          </p>
        </div>
        {canListen ? (
          <button
            type="button"
            onClick={() => setListening((v) => !v)}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[color:var(--tv-accent)] px-[2vw] py-[1.2vh] text-[1.05rem] font-bold text-white"
          >
            {listening ? <><Square className="h-5 w-5" /> Stop listening</> : <><Headphones className="h-5 w-5" /> Listen live</>}
          </button>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/20 px-[1.6vw] py-[1vh] text-[0.95rem] text-white/60">
            <Bell className="h-4 w-4" /> Not live yet
          </span>
        )}
        {listening && canListen && radio.live && <RadioAudio onEnded={() => setListening(false)} />}
        {listening && canListen && !radio.live && (
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
}
