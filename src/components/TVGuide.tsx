import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Radio, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// TV guide: every Mets game plus the Giants, Jets, Knicks, Rangers, Islanders and Nets.
// The six ESPN teams come from `ny_sports_games` (refreshed about hourly); the Mets come
// from MLB's free stats feed. Games we stream on MetsXMFanZone show in a row on top.

const ET = "America/New_York";
const MS_DAY = 86_400_000;
const DAYS_AHEAD = 30;
const PAGE_DAYS = 7;

type Team = { key: string; label: string; league: string; color: string; logo: string };
const TEAMS: Team[] = [
  { key: "mets", label: "Mets", league: "MLB", color: "#2c78c9", logo: "https://www.mlbstatic.com/team-logos/121.svg" },
  { key: "giants", label: "Giants", league: "NFL", color: "#3d6fd1", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png" },
  { key: "jets", label: "Jets", league: "NFL", color: "#1f9a6e", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png" },
  { key: "knicks", label: "Knicks", league: "NBA", color: "#f58426", logo: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png" },
  { key: "rangers", label: "Rangers", league: "NHL", color: "#4a7be0", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png" },
  { key: "islanders", label: "Islanders", league: "NHL", color: "#f0a25a", logo: "https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png" },
  { key: "nets", label: "Nets", league: "NBA", color: "#a1a1aa", logo: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png" },
];
const TEAM_BY_KEY = Object.fromEntries(TEAMS.map((t) => [t.key, t]));

type Game = {
  id: string;
  team: string;
  isHome: boolean;
  opponent: string;
  opponentLogo: string | null;
  start: string;
  venue: string | null;
  tv: string | null;
  state: "pre" | "in" | "post";
  detail: string | null;
  teamScore: string | null;
  oppScore: string | null;
  result: string | null;
};
type OurStream = { id: string; title: string; status: string; scheduled_start: string | null };

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: ET, ...o }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dayLabel = (key: string, iso: string) => {
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + MS_DAY).toISOString());
  const base = fmt(iso, { weekday: "long", month: "short", day: "numeric" });
  return key === today ? `Today · ${base}` : key === tomorrow ? `Tomorrow · ${base}` : base;
};

async function loadEspn(): Promise<Game[]> {
  const from = new Date(Date.now() - 5 * 3_600_000).toISOString();
  const to = new Date(Date.now() + DAYS_AHEAD * MS_DAY).toISOString();
  // ny_sports_games isn't in the generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ny_sports_games")
    .select("event_id, team_key, opponent_name, opponent_logo, is_home, start_time, venue, tv, state, status_detail, team_score, opponent_score, result")
    .gte("start_time", from)
    .lte("start_time", to)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: `${r.team_key}-${r.event_id}`,
    team: r.team_key,
    isHome: !!r.is_home,
    opponent: r.opponent_name ?? "TBD",
    opponentLogo: r.opponent_logo ?? null,
    start: r.start_time,
    venue: r.venue ?? null,
    tv: r.tv ?? null,
    state: r.state === "in" || r.state === "post" ? r.state : "pre",
    detail: r.status_detail ?? null,
    teamScore: r.team_score,
    oppScore: r.opponent_score,
    result: r.result ?? null,
  }));
}

async function loadMets(): Promise<Game[]> {
  const d = (ms: number) => dayKey(new Date(ms).toISOString());
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&startDate=${d(Date.now() - MS_DAY)}&endDate=${d(Date.now() + DAYS_AHEAD * MS_DAY)}&hydrate=team,linescore,broadcasts`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const out: Game[] = [];
  for (const day of json?.dates ?? []) {
    for (const g of day.games ?? []) {
      if (/postponed|cancel/i.test(g.status?.detailedState ?? "")) continue;
      const home = g.teams?.home, away = g.teams?.away;
      if (!home || !away) continue;
      const isHome = home.team?.id === 121;
      const mine = isHome ? home : away, opp = isHome ? away : home;
      const abstract = g.status?.abstractGameState;
      const state: Game["state"] = abstract === "Live" ? "in" : abstract === "Final" ? "post" : "pre";
      const tv = (g.broadcasts ?? []).filter((b: any) => b.type === "TV").map((b: any) => b.name).slice(0, 2).join(", ") || null;
      const ms = Number(mine.score), os = Number(opp.score);
      out.push({
        id: `mets-${g.gamePk}`,
        team: "mets",
        isHome,
        opponent: opp.team?.name ?? "TBD",
        opponentLogo: opp.team?.id ? `https://www.mlbstatic.com/team-logos/${opp.team.id}.svg` : null,
        start: g.gameDate,
        venue: g.venue?.name ?? null,
        tv,
        state,
        detail: state === "in" ? [g.linescore?.inningState?.slice(0, 3), g.linescore?.currentInningOrdinal].filter(Boolean).join(" ") || "Live" : state === "post" ? "Final" : null,
        teamScore: Number.isFinite(ms) && state !== "pre" ? String(ms) : null,
        oppScore: Number.isFinite(os) && state !== "pre" ? String(os) : null,
        result: state === "post" && Number.isFinite(ms) && Number.isFinite(os) ? (ms > os ? "W" : ms < os ? "L" : "T") : null,
      });
    }
  }
  return out;
}

const GameRow = ({ g }: { g: Game }) => {
  const t = TEAM_BY_KEY[g.team];
  const live = g.state === "in";
  const done = g.state === "post";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(g.start));
  const clock = `${parts.find((x) => x.type === "hour")?.value}:${parts.find((x) => x.type === "minute")?.value}`;
  const meridiem = parts.find((x) => x.type === "dayPeriod")?.value ?? "";
  return (
    <li className={`flex items-center gap-3 px-3 py-3 ${live ? "bg-red-500/10" : ""}`}>
      <div className="w-[62px] shrink-0 text-center leading-none">
        <span className="whitespace-nowrap font-display text-[26px] text-foreground">{clock}</span>
        <span className="block text-[11px] font-bold text-muted-foreground">{meridiem} ET</span>
      </div>
      <div className="flex shrink-0 items-center -space-x-2" aria-hidden="true">
        <img src={t.logo} alt="" loading="lazy" className="h-9 w-9 rounded-full bg-background/60 object-contain p-1 ring-2 ring-card" />
        {g.opponentLogo ? (
          <img src={g.opponentLogo} alt="" loading="lazy" className="h-9 w-9 rounded-full bg-background/60 object-contain p-1 ring-2 ring-card" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-muted ring-2 ring-card" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-tight text-foreground">
          {t.label} <span className="font-medium text-muted-foreground">{g.isHome ? "vs" : "@"}</span> {g.opponent}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded px-1.5 py-px text-[10px] font-extrabold tracking-wide text-white" style={{ background: t.color }}>{t.league}</span>
          {g.tv && !done ? (
            <span className="inline-flex min-w-0 items-center gap-1 font-bold text-foreground"><Tv className="h-3 w-3 shrink-0" /><span className="truncate">{g.tv}</span></span>
          ) : (
            <span className="truncate">{g.venue ?? (g.isHome ? "Home" : "Away")}</span>
          )}
        </p>
        {live && g.teamScore != null && (
          <p className="mt-0.5 text-xs font-bold text-foreground">{g.teamScore}-{g.oppScore} · {g.detail}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {live ? (
          <span className="inline-flex items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </span>
        ) : done ? (
          <span className={`text-xs font-extrabold ${g.result === "W" ? "text-green-400" : g.result === "L" ? "text-red-400" : "text-muted-foreground"}`}>
            {g.result} {g.teamScore}-{g.oppScore}
          </span>
        ) : null}
      </div>
    </li>
  );
};

const TVGuide = ({ initialTeam = "all", className = "" }: { initialTeam?: string; className?: string }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [streams, setStreams] = useState<OurStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState(TEAM_BY_KEY[initialTeam] ? initialTeam : "all");
  const [daysShown, setDaysShown] = useState(PAGE_DAYS);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [espn, mets] = await Promise.allSettled([loadEspn(), loadMets()]);
      if (!alive) return;
      const all = [...(espn.status === "fulfilled" ? espn.value : []), ...(mets.status === "fulfilled" ? mets.value : [])];
      setFailed(espn.status === "rejected" && mets.status === "rejected");
      setGames(all.sort((a, b) => +new Date(a.start) - +new Date(b.start)));
      setLoading(false);
    })();
    (async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("id, title, status, scheduled_start")
        .eq("published", true)
        .in("status", ["live", "scheduled"])
        .order("scheduled_start", { ascending: true })
        .limit(6);
      if (alive && data) setStreams(data as OurStream[]);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (TEAM_BY_KEY[initialTeam]) setFilter(initialTeam); }, [initialTeam]);

  const days = useMemo(() => {
    const list = games.filter((g) => {
      if (filter !== "all" && g.team !== filter) return false;
      // finished games drop off the guide 12 hours after they started
      return g.state !== "post" || Date.now() - +new Date(g.start) < 12 * 3_600_000;
    });
    const map = new Map<string, Game[]>();
    for (const g of list) {
      const k = dayKey(g.start);
      (map.get(k) ?? map.set(k, []).get(k)!).push(g);
    }
    return [...map.entries()];
  }, [games, filter]);

  const visibleDays = days.slice(0, daysShown);
  const selected = TEAM_BY_KEY[filter];

  return (
    <div role="region" aria-label="TV guide" className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">Mets + all 6 NY teams</p>
          <h2 className="font-display text-[30px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-4xl">TV Guide</h2>
        </div>
        <span className="mb-1 text-xs font-semibold text-muted-foreground">Times in ET</span>
      </div>

      {streams.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">On MetsXMFanZone</p>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
            {streams.map((s) => (
              <Link
                key={s.id}
                to={`/live/${s.id}`}
                className="flex min-h-[56px] w-[72vw] max-w-[300px] shrink-0 snap-start items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2 hover:border-primary/50 md:w-[280px]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.status === "live" ? "bg-red-700 text-white" : "bg-white/10 text-foreground"}`}>
                  {s.status === "live" ? <Radio className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.status === "live" ? "Live now" : s.scheduled_start ? `${fmt(s.scheduled_start, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET` : "Upcoming"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Filter by team" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
        {[{ key: "all", label: "All teams", color: "#ff5a1f" }, ...TEAMS].map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setFilter(t.key); setDaysShown(PAGE_DAYS); }}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${active ? "border-white/40 text-white" : "border-border/60 bg-card text-foreground hover:border-primary/50"}`}
              style={active ? { background: t.color } : undefined}
            >
              {!active && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)}</div>
      ) : failed ? (
        <p className="rounded-xl border border-border/50 bg-card px-4 py-8 text-center text-sm text-muted-foreground">The guide couldn't load. Check your connection and refresh.</p>
      ) : visibleDays.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-10 text-center">
          <Tv className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-2xl uppercase tracking-wide text-foreground">{selected ? `No ${selected.label} games coming up` : "No games coming up"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "mets" ? "Baseball is in the offseason. Spring Training starts in February." : "Check back soon, the guide updates through the day."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          {visibleDays.map(([key, list]) => (
            <div key={key} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
              <h3 className="border-b border-border/40 bg-background/40 px-3 py-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-foreground">{dayLabel(key, list[0].start)}</h3>
              <ul className="divide-y divide-border/30">{list.map((g) => <GameRow key={g.id} g={g} />)}</ul>
            </div>
          ))}
          {days.length > daysShown && (
            <button type="button" onClick={() => setDaysShown((n) => n + PAGE_DAYS)} className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-card text-sm font-bold text-foreground hover:border-primary/50 md:col-span-2">
              Show more days
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TVGuide;
