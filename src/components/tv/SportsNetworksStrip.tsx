import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Radio } from "lucide-react";

// Sports networks row for TV mode, shown under the scores strip on the home page.
// Lists the New York team streams from the live stream list. Hidden everywhere
// except TV mode (see .sports-networks in index.css).

type NetworkStream = {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  thumbnail_url: string | null;
};

const NY_TEAM = /knicks|rangers|islanders|nets|giants|jets/i;
const ET = "America/New_York";

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
        .limit(40);
      if (!alive || !data) return;
      setStreams((data as NetworkStream[]).filter((s) => NY_TEAM.test(s.title)).slice(0, 10));
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (streams.length === 0) return null;

  return (
    <section className="sports-networks container mx-auto max-w-[1600px] px-4 py-6" aria-label="Sports networks">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">Sports networks</p>
      <h2 className="mb-4 font-display text-[30px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-4xl">
        New York teams
      </h2>
      <div className="flex snap-x gap-4 overflow-x-auto pb-3 scrollbar-hide">
        {streams.map((s) => (
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
