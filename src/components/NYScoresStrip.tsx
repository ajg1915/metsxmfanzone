import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Scores for the six New York teams (Giants, Jets, Knicks, Nets, Rangers, Islanders)
// in one swipeable row. Data comes from the `ny-scores` Cloudflare Worker
// (cloudflare-worker/ny-scores-worker.js), which reads ESPN live — no Supabase.

const SCORES_URL =
  (import.meta.env.VITE_NY_SCORES_URL as string | undefined) || "https://ny-scores.metsxmfan.workers.dev";
const REFRESH_MS = 30_000;
const REFRESH_LIVE_MS = 15_000;
const ET = "America/New_York";

type Side = { name: string; abbr: string | null; logo: string | null; score: string | null };
type Game = {
  id: string;
  start: string;
  state: "pre" | "in" | "post";
  detail: string | null;
  isHome: boolean;
  team: Side;
  opponent: Side;
  result: "W" | "L" | "T" | null;
  tv: string | null;
};
type TeamScores = { key: string; label: string; league: string; main: Game | null; next: Game | null };
type Feed = { updatedAt: string; anyLive: boolean; teams: TeamScores[] };

const scheduleHref = (key: string) => `/mets-schedule-2026?team=${key}#ny-teams`;

const fmtET = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, ...opts }).format(new Date(iso));
const etDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// "Tonight 6:30 PM", "Sun 1:00 PM", "Oct 21, 7:30 PM"
function whenLabel(iso: string) {
  const d = new Date(iso);
  const time = fmtET(iso, { hour: "numeric", minute: "2-digit", hour12: true });
  const now = new Date();
  if (etDay(d) === etDay(now)) return `${Number(fmtET(iso, { hour: "numeric", hour12: false })) >= 17 ? "Tonight" : "Today"} ${time}`;
  if (etDay(d) === etDay(new Date(now.getTime() + 86_400_000))) return `Tomorrow ${time}`;
  if (d.getTime() - now.getTime() < 6 * 86_400_000) return `${fmtET(iso, { weekday: "short" })} ${time}`;
  return `${fmtET(iso, { month: "short", day: "numeric" })}, ${time}`;
}

function TeamRow({ side, bold, showScore, prefix }: { side: Side; bold: boolean; showScore: boolean; prefix?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        {side.logo ? (
          <img
            src={side.logo}
            alt=""
            className="h-6 w-6 shrink-0 object-contain"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <span className={cn("truncate text-sm", bold ? "font-bold text-foreground" : "text-muted-foreground")}>
          {prefix && <span className="mr-1 text-xs font-normal text-muted-foreground">{prefix}</span>}
          {side.name}
        </span>
      </span>
      {showScore ? (
        <span
          className={cn(
            "shrink-0 text-xl leading-none tabular-nums",
            bold ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground",
          )}
        >
          {side.score ?? "–"}
        </span>
      ) : (
        <span className="shrink-0 text-base text-muted-foreground/60">–</span>
      )}
    </div>
  );
}

function Badge({ game }: { game: Game }) {
  if (game.state === "in")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-destructive-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive-foreground" />
        Live
      </span>
    );
  if (game.state === "post" && game.result)
    return (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] font-extrabold",
          game.result === "W" ? "bg-green-500/15 text-green-400" : game.result === "L" ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground",
        )}
      >
        {game.result}
      </span>
    );
  return <span className="text-[11px] font-medium text-muted-foreground">{game.state === "post" ? "Final" : "Next"}</span>;
}

function ScoreCard({ t }: { t: TeamScores }) {
  const navigate = useNavigate();
  const g = t.main;
  const base =
    "flex min-h-[138px] w-[190px] shrink-0 snap-start flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  if (!g) {
    return (
      <button
        type="button"
        onClick={() => navigate(scheduleHref(t.key))}
        aria-label={`${t.label}: no games scheduled, open the schedule`}
        className={cn(base, "border-border/40")}
      >
        <span className="text-xs font-semibold text-muted-foreground">
          {t.label} · {t.league}
        </span>
        <span className="mt-1 text-sm font-semibold text-foreground">No games scheduled</span>
        <span className="mt-auto text-xs text-muted-foreground">Tap for the schedule</span>
      </button>
    );
  }

  const live = g.state === "in";
  const played = g.state !== "pre";
  const us = Number(g.team.score);
  const them = Number(g.opponent.score);
  const usBold = !played || us >= them;
  const themBold = played && them > us;

  let footer: string;
  if (live) footer = g.detail || "Live";
  else if (played) footer = [g.detail || "Final", t.next ? `Next ${whenLabel(t.next.start)}` : null].filter(Boolean).join(" · ");
  else footer = [whenLabel(g.start), g.tv].filter(Boolean).join(" · ");

  const summary = played
    ? `${t.label} ${g.team.score}, ${g.opponent.name} ${g.opponent.score}, ${live ? `live, ${g.detail ?? ""}` : "final"}`
    : `${t.label} ${g.isHome ? "vs" : "at"} ${g.opponent.name}, ${whenLabel(g.start)}${g.tv ? ` on ${g.tv}` : ""}`;

  return (
    <button
      type="button"
      onClick={() => navigate(scheduleHref(t.key))}
      aria-label={summary}
      className={cn(base, live ? "border-destructive/70" : "border-border/40")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {t.label} · {t.league}
        </span>
        <Badge game={g} />
      </div>

      <div className="flex flex-col gap-1.5">
        <TeamRow side={{ ...g.team, name: t.label }} bold={usBold} showScore={played} />
        <TeamRow side={g.opponent} bold={themBold} showScore={played} prefix={g.isHome ? "vs" : "@"} />
      </div>

      <span
        className={cn(
          "mt-auto line-clamp-1 text-xs",
          live ? "font-semibold text-destructive" : "text-muted-foreground",
        )}
      >
        {footer}
      </span>
    </button>
  );
}

export default function NYScoresStrip() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, liveRef.current ? REFRESH_LIVE_MS : REFRESH_MS);
    };

    async function load() {
      if (document.hidden) return schedule(); // don't poll a background tab
      try {
        const res = await fetch(SCORES_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Feed;
        if (cancelled || !Array.isArray(data?.teams)) return;
        liveRef.current = !!data.anyLive;
        setFeed(data);
        setFailed(false);
      } catch {
        // keep showing the last scores we had; only hide if we never got any
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) schedule();
      }
    }

    const onVisible = () => {
      if (!document.hidden) load();
    };

    load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (failed && !feed) return null;

  const anyLive = !!feed?.anyLive;

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

      <div className="flex scroll-px-4 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8">
        {feed
          ? feed.teams.map((t) => <ScoreCard key={t.key} t={t} />)
          : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[138px] w-[190px] shrink-0 rounded-xl" />)}
      </div>
    </section>
  );
}
