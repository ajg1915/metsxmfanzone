import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio } from "lucide-react";
import channelMlb from "@/assets/channel-mlb.jpg";
import channelEspn from "@/assets/channel-espn.jpg";
import channelMsg from "@/assets/channel-msg.jpg";

// Sports networks row for TV mode, shown under the scores strip on the home page.
// Lists the sports network streams (SNY, MSG, ESPN, MLB Network) from the live stream list. Hidden everywhere
// except TV mode (see .sports-networks in index.css).

type NetworkStream = {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  thumbnail_url: string | null;
};

// Sports networks: SNY, MSG, ESPN, MLB Network and other 24/7 channels
const NETWORK = /\bsny\b|\bmsg\b|espn|mlb network|apple tv|prime video|peacock|24\/7|network/i;
const ET = "America/New_York";

// Apple TV, Prime Video and Peacock always show, even when nothing is live.
const PLATFORMS = [
  { re: /apple tv|mlb network/i, title: "Apple TV", to: "/apple-tv", thumb: channelMlb },
  { re: /prime video|espn/i, title: "Prime Video", to: "/prime-video", thumb: channelEspn },
  { re: /peacock|\bmsg\b/i, title: "Peacock", to: "/peacock", thumb: channelMsg },
];

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso)) + " ET";

const SportsNetworksStrip = () => {
  const [streams, setStreams] = useState<NetworkStream[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id, title, status, scheduled_start, thumbnail_url")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .order("scheduled_start", { ascending: true })
        .limit(200);
      if (!alive || !data) return;
      setStreams((data as NetworkStream[]).filter((s) => NETWORK.test(s.title)).slice(0, 10));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const platformCards = PLATFORMS.map((p) => {
    const matches = streams.filter((s) => p.re.test(s.title));
    const found = matches.find((s) => s.status === "live") || matches[0];
    return { p, found, ids: matches.map((m) => m.id) };
  });
  const usedIds = new Set(platformCards.flatMap((c) => c.ids));
  const otherStreams = streams.filter((s) => !usedIds.has(s.id));

  return (
    <section className="sports-networks container mx-auto max-w-[1600px] px-4 py-6" aria-label="Sports networks">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--tv-accent)]">Sports networks</p>
      <h2 className="mb-4 font-display text-[30px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-4xl">
        Networks
      </h2>
      <div className="flex snap-x gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {platformCards.map(({ p, found }) => (
          <Link
            key={p.title}
            to={p.to}
            className="group w-[320px] shrink-0 snap-start rounded-xl border border-border/50 bg-card p-2 transition-colors hover:border-primary/50"
          >
            <span className="relative block aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <img src={found?.thumbnail_url || p.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              {found?.status === "live" ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  <Radio className="h-3 w-3" /> LIVE
                </span>
              ) : (
                <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-primary-foreground">
                  {found ? "UPCOMING" : "PREMIUM"}
                </span>
              )}
            </span>
            <span className="mt-2 block px-1">
              <span className="block truncate text-base font-bold text-foreground">{p.title}</span>
              <span className="block text-sm text-muted-foreground">
                {found?.status === "live" ? "Live now" : found?.scheduled_start ? when(found.scheduled_start) : "Premium: Mets game events"}
              </span>
            </span>
          </Link>
        ))}
        {otherStreams.map((s) => (
          <Link
            key={s.id}
            to={`/live/${s.id}`}
            className="group w-[320px] shrink-0 snap-start rounded-xl border border-border/50 bg-card p-2 transition-colors hover:border-primary/50"
          >
            <span className="relative block aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {s.thumbnail_url && (
                <img src={s.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {s.status === "live" && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  <Radio className="h-3 w-3" /> LIVE
                </span>
              )}
            </span>
            <span className="mt-2 block px-1">
              <span className="block truncate text-base font-bold text-foreground">{s.title.trim()}</span>
              <span className="block text-sm text-muted-foreground">
                {s.status === "live" ? "Live now" : s.scheduled_start ? when(s.scheduled_start) : "Upcoming"}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default SportsNetworksStrip;
