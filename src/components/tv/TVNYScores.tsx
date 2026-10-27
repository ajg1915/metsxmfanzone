import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// NY team scores for the TV home screen (Giants, Jets, Knicks, Nets, Rangers, Islanders).
// Same Cloudflare Worker feed as the NY Scores strip on the website.

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

const fmtET = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, ...opts }).format(new Date(iso));
const etDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function whenLabel(iso: string) {
  const d = new Date(iso);
  const time = fmtET(iso, { hour: "numeric", minute: "2-digit", hour12: true });
  const now = new Date();
  if (etDay(d) === etDay(now)) return `${Number(fmtET(iso, { hour: "numeric", hour12: false })) >= 17 ? "Tonight" : "Today"} ${time}`;
  if (etDay(d) === etDay(new Date(now.getTime() + 86_400_000))) return `Tomorrow ${time}`;
  if (d.getTime() - now.getTime() < 6 * 86_400_000) return `${fmtET(iso, { weekday: "short" })} ${time}`;
  return `${fmtET(iso, { month: "short", day: "numeric" })}, ${time}`;
}

function Row({ side, bold, showScore, prefix }: { side: Side; bold: boolean; showScore: boolean; prefix?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        {side.logo ? (
          <img
            src={side.logo}
            alt=""
            className="h-[2.2rem] w-[2.2rem] shrink-0 object-contain"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span className="h-[2.2rem] w-[2.2rem] shrink-0" />
        )}
        <span
          className={cn(
            "truncate text-[1.25rem]",
            bold ? "font-bold text-[color:var(--tv-text)]" : "text-[color:var(--tv-subtext)]",
          )}
        >
          {prefix && <span className="mr-1.5 text-[1rem] font-normal text-[color:var(--tv-subtext)]">{prefix}</span>}
          {side.name}
        </span>
      </span>
      {showScore && (
        <span
          className={cn(
            "shrink-0 text-[1.9rem] leading-none tabular-nums",
            bold ? "font-extrabold text-[color:var(--tv-text)]" : "font-semibold text-[color:var(--tv-subtext)]",
          )}
        >
          {side.score ?? "–"}
        </span>
      )}
    </div>
  );
}

function Card({ t, onOpen }: { t: TeamScores; onOpen: () => void }) {
  const g = t.main;
  const base =
    "flex min-h-[180px] w-[22vw] min-w-[270px] shrink-0 flex-col gap-3 rounded-[0.9rem] border border-white/5 bg-[color:var(--tv-surface)] p-[1.3vw] text-left focus:outline-none";
  const onFocus = (e: React.FocusEvent<HTMLButtonElement>) =>
    e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });

  if (!g) {
    return (
      <button type="button" onClick={onOpen} onFocus={onFocus} className={base}>
        <span className="text-[1.05rem] font-semibold text-[color:var(--tv-subtext)]">
          {t.label} · {t.league}
        </span>
        <span className="text-[1.3rem] font-semibold text-[color:var(--tv-text)]">No games scheduled</span>
      </button>
    );
  }

  const live = g.state === "in";
  const played = g.state !== "pre";
  const us = Number(g.team.score);
  const them = Number(g.opponent.score);

  let footer: string;
  if (live) footer = g.detail || "Live";
  else if (played) footer = [g.detail || "Final", t.next ? `Next ${whenLabel(t.next.start)}` : null].filter(Boolean).join(" · ");
  else footer = [whenLabel(g.start), g.tv].filter(Boolean).join(" · ");

  return (
    <button type="button" onClick={onOpen} onFocus={onFocus} className={cn(base, live && "border-[#e11d48]/70")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[1.05rem] font-semibold text-[color:var(--tv-subtext)]">
          {t.label} · {t.league}
        </span>
        {live ? (
          <span className="rounded-md bg-[#e11d48] px-2.5 py-0.5 text-[0.9rem] font-bold uppercase tracking-wider text-white">Live</span>
        ) : played && g.result ? (
          <span
            className={cn(
              "rounded-md px-2.5 py-0.5 text-[0.9rem] font-bold",
              g.result === "W" ? "bg-green-500/20 text-green-400" : g.result === "L" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-[color:var(--tv-subtext)]",
            )}
          >
            {g.result}
          </span>
        ) : (
          <span className="text-[0.95rem] text-[color:var(--tv-subtext)]">{played ? "Final" : "Next"}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Row side={{ ...g.team, name: t.label }} bold={!played || us >= them} showScore={played} />
        <Row side={g.opponent} bold={played && them > us} showScore={played} prefix={g.isHome ? "vs" : "@"} />
      </div>
      <span className={cn("mt-auto line-clamp-1 text-[1.05rem]", live ? "font-semibold text-[#fb7185]" : "text-[color:var(--tv-subtext)]")}>
        {footer}
      </span>
    </button>
  );
}

export default function TVNYScores() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<Feed | null>(null);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, liveRef.current ? REFRESH_LIVE_MS : REFRESH_MS);
    };
    async function load() {
      if (document.hidden) return schedule();
      try {
        const res = await fetch(SCORES_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Feed;
        if (cancelled || !Array.isArray(data?.teams)) return;
        liveRef.current = !!data.anyLive;
        setFeed(data);
      } catch {
        /* keep the last scores; stay hidden if we never had any */
      } finally {
        if (!cancelled) schedule();
      }
    }
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!feed) return null;

  return (
    <section className="group/rail relative mt-[4vh]" aria-label="New York team scores">
      <div className="mb-[1.4vh] flex items-center gap-3 pl-[0.2vw]">
        <span
          className={cn("h-3 w-3 rounded-full", feed.anyLive ? "animate-pulse bg-[#e11d48]" : "bg-white/30")}
          aria-hidden="true"
        />
        <h2 className="text-[1.7rem] font-medium text-[color:var(--tv-text)]">NY Scores</h2>
      </div>
      <div className="flex gap-[1.2vw] overflow-x-auto px-[0.6vw] py-[1.8vh] scrollbar-none">
        {feed.teams.map((t) => (
          <Card key={t.key} t={t} onOpen={() => navigate(`/mets-schedule-2027?team=${t.key}#ny-teams`)} />
        ))}
      </div>
    </section>
  );
}
