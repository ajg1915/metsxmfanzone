import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Scores for every New York team in one swipe strip.
// Jets / Giants / Knicks / Nets / Rangers / Islanders come from the `ny_sports_games`
// table (refreshed about hourly from ESPN's schedule feed); the Mets come straight
// from MLB's free stats feed.

const ET = "America/New_York";
const MS_DAY = 86_400_000;
const METS_ID = 121;

type ScoreGame = {
  id: string;
  isHome: boolean;
  opponent: string;
  opponentLogo: string | null;
  start: string; // ISO
  state: "pre" | "in" | "post";
  detail: string | null;
  teamScore: string | null;
  oppScore: string | null;
  result: "W" | "L" | "T" | null;
};

type TeamCard = {
  key: string;
  label: string;
  league: string;
  color: string;
  href: string;
  main: ScoreGame | null;
  next: ScoreGame | null;
};

type TeamDef = { key: string; label: string; league: string; color: string; href: string };

const TEAMS: TeamDef[] = [
  { key: "mets", label: "Mets", league: "MLB", color: "#2c78c9", href: "/mets-scores" },
  { key: "giants", label: "Giants", league: "NFL", color: "#3d6fd1", href: "/mets-schedule-2026?team=giants#ny-teams" },
  { key: "jets", label: "Jets", league: "NFL", color: "#1f9a6e", href: "/mets-schedule-2026?team=jets#ny-teams" },
  { key: "knicks", label: "Knicks", league: "NBA", color: "#f58426", href: "/mets-schedule-2026?team=knicks#ny-teams" },
  { key: "rangers", label: "Rangers", league: "NHL", color: "#4a7be0", href: "/mets-schedule-2026?team=rangers#ny-teams" },
  { key: "islanders", label: "Islanders", league: "NHL", color: "#f0a25a", href: "/mets-schedule-2026?team=islanders#ny-teams" },
  { key: "nets", label: "Nets", league: "NBA", color: "#a1a1aa", href: "/mets-schedule-2026?team=nets#ny-teams" },
];

const fmtET = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, ...opts }).format(new Date(iso));
const whenLabel = (iso: string) =>
  `${fmtET(iso, { weekday: "short", month: "short", day: "numeric" })}, ${fmtET(iso, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} ET`;
const etDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// live game first, then today's game (final or still to play), else the latest
// final from the last 7 days, else the next game. A team with nothing in range
// still gets a card (main = null) so all of them always show.
function pick(games: ScoreGame[]): { main: ScoreGame | null; next: ScoreGame | null } {
  const sorted = [...games].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const live = sorted.find((g) => g.state === "in");
  const today = etDate(new Date());
  const todays = sorted.filter((g) => etDate(new Date(g.start)) === today);
  const weekAgo = Date.now() - 7 * MS_DAY;
  const finals = sorted.filter((g) => g.state === "post" && +new Date(g.start) >= weekAgo);
  const upcoming = sorted.filter((g) => g.state === "pre");
  const main = live ?? todays[todays.length - 1] ?? finals[finals.length - 1] ?? upcoming[0] ?? null;
  const next = main && main.state !== "pre" ? upcoming.find((g) => g.id !== main.id) ?? null : null;
  return { main, next: main ? next : upcoming[0] ?? null };
}

async function loadEspnTeams(): Promise<Record<string, ScoreGame[]>> {
  const from = new Date(Date.now() - 7 * MS_DAY).toISOString();
  const to = new Date(Date.now() + 60 * MS_DAY).toISOString();
  // ny_sports_games isn't in the generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("ny_sports_games")
    .select("event_id, team_key, opponent_name, opponent_logo, is_home, start_time, state, status_detail, team_score, opponent_score, result")
    .gte("start_time", from)
    .lte("start_time", to)
    .order("start_time", { ascending: true });
  if (error) throw error;

  const byTeam: Record<string, ScoreGame[]> = {};
  for (const r of data ?? []) {
    (byTeam[r.team_key] ??= []).push({
      id: String(r.event_id),
      isHome: !!r.is_home,
      opponent: r.opponent_name ?? "TBD",
      opponentLogo: r.opponent_logo ?? null,
      start: r.start_time,
      state: r.state === "in" || r.state === "post" ? r.state : "pre",
      detail: r.status_detail ?? null,
      teamScore: r.team_score,
      oppScore: r.opponent_score,
      result: r.result ?? null,
    });
  }
  return byTeam;
}

async function loadMets(): Promise<ScoreGame[]> {
  const start = etDate(new Date(Date.now() - 7 * MS_DAY));
  const end = etDate(new Date(Date.now() + 14 * MS_DAY));
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_ID}&startDate=${start}&endDate=${end}&hydrate=team,linescore`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const out: ScoreGame[] = [];
  for (const day of json?.dates ?? []) {
    for (const g of day.games ?? []) {
      const detailed: string = g.status?.detailedState ?? "";
      if (/postponed|cancel/i.test(detailed)) continue;
      const abstract: string = g.status?.abstractGameState ?? "";
      const home = g.teams?.home;
      const away = g.teams?.away;
      if (!home || !away) continue;
      const isHome = home.team?.id === METS_ID;
      const mine = isHome ? home : away;
      const opp = isHome ? away : home;
      const state: ScoreGame["state"] = abstract === "Live" ? "in" : abstract === "Final" ? "post" : "pre";
      const ls = g.linescore;
      const detail =
        state === "in"
          ? [ls?.inningState?.slice(0, 3), ls?.currentInningOrdinal].filter(Boolean).join(" ") || "Live"
          : state === "post"
            ? "Final"
            : null;
      const ms = Number(mine.score);
      const os = Number(opp.score);
      out.push({
        id: String(g.gamePk),
        isHome,
        opponent: opp.team?.name ?? "TBD",
        opponentLogo: opp.team?.id ? `https://www.mlbstatic.com/team-logos/${opp.team.id}.svg` : null,
        start: g.gameDate,
        state,
        detail,
        teamScore: state === "pre" || Number.isNaN(ms) ? null : String(ms),
        oppScore: state === "pre" || Number.isNaN(os) ? null : String(os),
        result: state === "post" && !Number.isNaN(ms) && !Number.isNaN(os) ? (ms > os ? "W" : ms < os ? "L" : "T") : null,
      });
    }
  }
  return out;
}

function ScoreCard({ card }: { card: TeamCard }) {
  const navigate = useNavigate();
  const { main, next } = card;
  if (!main) {
    return (
      <button
        type="button"
        onClick={() => navigate(card.href)}
        aria-label={`${card.label}: no game in the next two months, tap for the schedule`}
        className="flex min-h-[136px] w-[172px] shrink-0 snap-start flex-col gap-1.5 rounded-xl border border-border/40 bg-card p-3 text-left transition-colors hover:bg-card/80"
        style={{ borderLeft: `4px solid ${card.color}` }}
      >
        <span className="text-sm font-bold leading-none text-foreground">
          {card.label} <span className="text-[10px] font-semibold text-muted-foreground">{card.league}</span>
        </span>
        <span className="mt-1 text-sm font-semibold leading-snug text-foreground">No game today</span>
        {next ? (
          <span className="text-xs text-muted-foreground">Next: {whenLabel(next.start)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Schedule coming soon</span>
        )}
      </button>
    );
  }
  const live = main.state === "in";
  const final = main.state === "post";
  const hasScore = (live || final) && main.teamScore != null && main.oppScore != null;
  const summary = hasScore
    ? `${card.label} ${main.teamScore}, ${main.opponent} ${main.oppScore}, ${live ? "live" : "final"}`
    : `${card.label} ${main.isHome ? "vs" : "at"} ${main.opponent}, ${whenLabel(main.start)}`;

  return (
    <button
      type="button"
      onClick={() => navigate(card.href)}
      aria-label={summary}
      className="flex min-h-[136px] w-[172px] shrink-0 snap-start flex-col gap-1.5 rounded-xl border border-border/40 bg-card p-3 text-left transition-colors hover:bg-card/80"
      style={{ borderLeft: `4px solid ${card.color}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold leading-none text-foreground">
          {card.label} <span className="text-[10px] font-semibold text-muted-foreground">{card.league}</span>
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-destructive-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive-foreground" />
            Live
          </span>
        ) : final ? (
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Final</span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {main.opponentLogo && (
          <img
            src={main.opponentLogo}
            alt=""
            className="h-5 w-5 shrink-0 object-contain"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <span className="line-clamp-1 text-xs text-muted-foreground">
          {main.isHome ? "vs" : "@"} {main.opponent}
        </span>
      </div>

      {hasScore ? (
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-2xl font-extrabold leading-none tabular-nums",
              main.result === "W" ? "text-green-400" : main.result === "L" ? "text-red-400" : "text-foreground",
            )}
          >
            {main.teamScore}–{main.oppScore}
          </span>
          {final && main.result && <span className="text-xs font-bold text-muted-foreground">{main.result}</span>}
        </div>
      ) : (
        <span className="text-sm font-semibold leading-snug text-foreground">{whenLabel(main.start)}</span>
      )}

      {live && main.detail && <span className="text-xs font-semibold text-destructive">{main.detail}</span>}
      {next && <span className="mt-auto text-[11px] leading-tight text-muted-foreground">Next: {whenLabel(next.start)}</span>}
    </button>
  );
}

export default function NYScoresStrip() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<TeamCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [espn, mets] = await Promise.allSettled([loadEspnTeams(), loadMets()]);
      if (cancelled) return;
      if (espn.status === "rejected" && mets.status === "rejected") {
        setFailed(true);
        return;
      }
      const espnGames = espn.status === "fulfilled" ? espn.value : {};
      const metsGames = mets.status === "fulfilled" ? mets.value : [];

      const built: TeamCard[] = [];
      for (const t of TEAMS) {
        built.push({ ...t, ...pick(t.key === "mets" ? metsGames : espnGames[t.key] ?? []) });
      }
      // live games jump to the front; everything else keeps the team order above
      built.sort((a, b) => Number(b.main?.state === "in") - Number(a.main?.state === "in"));
      setFailed(false);
      setCards(built);
    };

    load();
    const timer = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (failed) return null;

  const anyLive = !!cards?.some((c) => c.main?.state === "in");

  return (
    <section aria-label="New York team scores" className="relative py-4">
      <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn("h-2.5 w-2.5 rounded-full", anyLive ? "animate-pulse bg-red-500" : "bg-muted-foreground/50")}
              aria-hidden="true"
            />
            <h2 className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-2xl md:text-3xl">NY Scores</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/mets-schedule-2026#ny-teams")}
            className="flex min-h-[44px] items-center gap-1 pl-2 text-xs font-medium text-primary transition-colors hover:text-primary/80 sm:text-sm"
          >
            Schedules
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex scroll-px-4 snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8">
        {cards
          ? cards.map((c) => <ScoreCard key={c.key} card={c} />)
          : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[136px] w-[172px] shrink-0 rounded-xl" />)}
      </div>
    </section>
  );
}
