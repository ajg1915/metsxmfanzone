import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Newspaper, Play, Sun, Tv } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

const METS_TEAM_ID = 121;
const SEASON = 2027;
const ET = "America/New_York";
// Mets announced the 2027 opener: Fri Feb 19, 2027 vs. the Marlins at Clover Park.
// Used only until MLB's feed returns the real first game.
const FALLBACK_OPENER = "2027-02-19T18:10:00Z";

interface Game {
  id: number;
  date: string;
  isHome: boolean;
  opponent: string;
  venue: string;
  timeTBD: boolean;
  status: string;
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: ET, ...o }).format(new Date(iso));

const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
};

export default function SpringTraining() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&season=${SEASON}&gameType=S&startDate=${SEASON}-02-01&endDate=${SEASON}-04-05&hydrate=team,venue`
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const list: Game[] = [];
        for (const day of json.dates ?? []) {
          for (const g of day.games ?? []) {
            const isHome = g.teams.home.team.id === METS_TEAM_ID;
            list.push({
              id: g.gamePk,
              date: g.gameDate,
              isHome,
              opponent: (isHome ? g.teams.away : g.teams.home).team.name,
              venue: g.venue?.name ?? "",
              timeTBD: g.status?.startTimeTBD === true,
              status: g.status?.detailedState ?? "",
            });
          }
        }
        list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
        if (!cancelled) setGames(list);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const opener = games[0];
  const target = opener ? +new Date(opener.date) : +new Date(FALLBACK_OPENER);
  const days = Math.max(0, Math.ceil((target - now) / 86_400_000));
  const upcoming = useMemo(() => games.filter((g) => +new Date(g.date) > now - 6 * 3_600_000), [games, now]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Spring Training 2027 — Schedule, Streams & Camp News | MetsXMFanZone"
        description="Mets Spring Training 2027: full Grapefruit League schedule, countdown to the first game, live streams and camp news from Port St. Lucie."
        keywords="Mets spring training, Mets spring training schedule 2027, Grapefruit League, Clover Park, Port St. Lucie"
        canonical="https://metsxmfanzone.com/spring-training"
        breadcrumbs={[{ name: "Home", url: "/" }, { name: "Spring Training", url: "/spring-training" }]}
      />
      <Navigation />
      <main className="container mx-auto max-w-5xl px-4 pb-16 pt-24 sm:pt-28">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]"><Sun className="h-3.5 w-3.5" /> Grapefruit League</p>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-wide text-foreground sm:text-6xl">Spring Training</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> Clover Park, Port St. Lucie, Florida</p>
          </div>
          <Link to="/spring-training-live" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-6 font-display text-lg font-bold uppercase tracking-wider text-white hover:opacity-90">
            <Play className="h-4 w-4 fill-white" /> Watch Spring Training live
          </Link>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Spring Training at a glance">
          <div className="rounded-2xl border border-border/50 bg-card/80 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">First game in</p>
            <p className="font-display text-5xl font-bold leading-none text-[#ff5a1f]">{days}<span className="ml-1 text-base text-foreground">{days === 1 ? "day" : "days"}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{opener ? `${fmt(opener.date, { weekday: "short", month: "short", day: "numeric" })} ${opener.isHome ? "vs" : "at"} ${opener.opponent}` : "Fri, Feb 19 vs Miami Marlins"}</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/80 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Games on the schedule</p>
            <p className="font-display text-5xl font-bold leading-none text-foreground">{loading ? "…" : games.length || 30}</p>
            <p className="mt-1 text-xs text-muted-foreground">Start times come from MLB and update as they are set.</p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/80 p-5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Tv className="h-3.5 w-3.5" /> How to watch</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">Spring Training streams are included on the free plan. Replays and camp news live here too.</p>
          </div>
        </section>

        <section className="mt-8" aria-label="Spring Training schedule">
          <h2 className="mb-3 flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wider text-foreground"><CalendarDays className="h-5 w-5 text-[#ff5a1f]" /> Schedule</h2>
          {loading && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}
          {!loading && failed && <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">The schedule feed is not answering right now. Try again in a minute.</p>}
          {!loading && !failed && upcoming.length === 0 && <p className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">MLB has not posted the full Spring Training schedule yet. It appears here automatically.</p>}
          <ul className="space-y-2">
            {upcoming.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-3">
                <div className="w-24 shrink-0 font-display text-lg font-bold uppercase leading-tight text-foreground">{fmt(g.date, { month: "short", day: "numeric" })}<span className="block text-xs font-semibold text-muted-foreground">{fmt(g.date, { weekday: "short" })}</span></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{g.isHome ? "vs" : "at"} {g.opponent}</p>
                  <p className="truncate text-xs text-muted-foreground">{g.venue}</p>
                </div>
                <p className="hidden shrink-0 text-sm text-muted-foreground sm:block">{g.timeTBD ? "Time TBA" : `${fmt(g.date, { hour: "numeric", minute: "2-digit" })} ET`}</p>
                <Link to="/spring-training-live" className="shrink-0 rounded-lg bg-[#ff5a1f] px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-white hover:opacity-90">Watch</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="More Spring Training">
          <Link to="/blog" className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 p-4 hover:border-[#ff5a1f]/60"><Newspaper className="h-5 w-5 text-[#ff5a1f]" /><span className="font-semibold text-foreground">Camp news on the blog</span></Link>
          <Link to="/mets-tracker" className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 p-4 hover:border-[#ff5a1f]/60"><Newspaper className="h-5 w-5 text-[#ff5a1f]" /><span className="font-semibold text-foreground">Mets Tracker: trades &amp; signings</span></Link>
          <Link to="/replay-games" className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 p-4 hover:border-[#ff5a1f]/60"><Play className="h-5 w-5 text-[#ff5a1f]" /><span className="font-semibold text-foreground">Replays</span></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
