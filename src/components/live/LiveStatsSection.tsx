import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Film, Newspaper, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  METS_ID,
  useMetsLiveGame,
  type BatterLine,
  type GameView,
  type NextGame,
  type PitcherLine,
} from "@/lib/metsLiveGame";

const ACCENT = "#ff5a1f";
const METS_BLUE = "#0f46a8";

/* ---------- small pieces ---------- */

const Diamond = ({ bases }: { bases: GameView["bases"] }) => (
  <svg width="56" height="56" viewBox="0 0 54 54" role="img" aria-label={`Runners on: ${[bases.first && "first", bases.second && "second", bases.third && "third"].filter(Boolean).join(", ") || "none"}`}>
    <rect x="20" y="4" width="14" height="14" transform="rotate(45 27 11)" fill={bases.second ? ACCENT : "transparent"} stroke="currentColor" strokeWidth="2" />
    <rect x="38" y="22" width="14" height="14" transform="rotate(45 45 29)" fill={bases.first ? ACCENT : "transparent"} stroke="currentColor" strokeWidth="2" />
    <rect x="2" y="22" width="14" height="14" transform="rotate(45 9 29)" fill={bases.third ? ACCENT : "transparent"} stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Dots = ({ label, count, max, color }: { label: string; count: number; max: number; color: string }) => (
  <div className="flex items-center gap-1.5" aria-label={`${count} ${label}`}>
    <span className="w-3 text-[12px] font-bold text-muted-foreground">{label[0].toUpperCase()}</span>
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className="h-3 w-3 rounded-full border-2" style={{ borderColor: color, background: i < count ? color : "transparent" }} />
    ))}
  </div>
);

const Stat = ({ label, value }: { label: string; value?: string | number }) => (
  <div className="text-center">
    <div className="font-display text-xl font-bold leading-none text-foreground sm:text-2xl">{value ?? "-"}</div>
    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

const TeamChipView = ({ abbr, id, runs, dim }: { abbr: string; id: number; runs: number; dim?: boolean }) => (
  <div className="flex items-center gap-3">
    <span
      className="inline-flex h-8 w-14 items-center justify-center rounded-md font-display text-lg font-bold text-white"
      style={{ background: id === METS_ID ? METS_BLUE : "#475569" }}
    >
      {abbr}
    </span>
    <span className={cn("w-10 text-right font-display text-4xl font-bold leading-none tabular-nums", dim ? "text-muted-foreground" : "text-foreground")}>{runs}</span>
  </div>
);

/* ---------- game center ---------- */

const TABS = ["Live", "Box", "Pitching", "Plays"] as const;
type Tab = (typeof TABS)[number];

const LineScore = ({ g }: { g: GameView }) => {
  const cols = Math.max(9, g.innings.length);
  const nums = Array.from({ length: cols }, (_, i) => i + 1);
  const cell = (side: "away" | "home", n: number) => {
    const inn = g.innings.find((i) => i.num === n);
    const v = inn?.[side];
    return v === undefined || v === null ? "-" : String(v);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[440px] table-fixed border-collapse text-center text-sm tabular-nums">
        <thead>
          <tr className="text-[12px] font-bold text-muted-foreground">
            <th className="w-14 text-left" />
            {nums.map((n) => (
              <th key={n} className="w-8 py-1">{n}</th>
            ))}
            <th className="w-9 text-foreground">R</th>
            <th className="w-9">H</th>
            <th className="w-9">E</th>
          </tr>
        </thead>
        <tbody>
          {(["away", "home"] as const).map((side) => {
            const t = g[side];
            return (
              <tr key={side} className="border-t border-border/40">
                <td className="py-1.5 text-left font-display text-base font-bold text-foreground">{t.abbr}</td>
                {nums.map((n) => (
                  <td key={n} className="py-1.5 text-foreground/90">{cell(side, n)}</td>
                ))}
                <td className="font-display text-lg font-bold" style={{ color: t.id === METS_ID ? ACCENT : undefined }}>{g.runs[side]}</td>
                <td>{g.hits[side]}</td>
                <td>{g.errors[side]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const PitchList = ({ g }: { g: GameView }) => {
  if (!g.pitches.length) return <p className="text-sm text-muted-foreground">Pitches for this at-bat show up here.</p>;
  const color = { ball: "text-muted-foreground", strike: "text-amber-400", inplay: "text-emerald-400" } as const;
  return (
    <ol className="divide-y divide-border/40">
      {g.pitches.map((p) => (
        <li key={p.n} className="flex items-center gap-2 py-2 text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 font-display text-sm font-bold text-foreground">{p.n}</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{p.type}</span>
          {p.mph !== undefined && <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">{p.mph}</span>}
          <span className={cn("w-20 shrink-0 text-right text-[12px] font-bold", color[p.kind])}>{p.call}</span>
        </li>
      ))}
    </ol>
  );
};

const BoxTable = ({ rows }: { rows: BatterLine[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[320px] text-sm tabular-nums">
      <thead>
        <tr className="text-[12px] font-bold text-muted-foreground">
          <th className="py-1 text-left">Player</th>
          {["AB", "R", "H", "RBI", "BB", "K"].map((h) => (
            <th key={h} className="w-10 text-center">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border/40">
            <td className="py-2 font-semibold text-foreground">
              {r.name} <span className="text-[12px] font-normal text-muted-foreground">{r.pos}</span>
            </td>
            <td className="text-center">{r.ab}</td>
            <td className="text-center">{r.r}</td>
            <td className="text-center font-bold text-foreground">{r.h}</td>
            <td className="text-center">{r.rbi}</td>
            <td className="text-center">{r.bb}</td>
            <td className="text-center">{r.k}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={7} className="py-3 text-muted-foreground">Lineup posts when the game gets going.</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const PitchTable = ({ title, rows }: { title: string; rows: PitcherLine[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[320px] text-sm tabular-nums">
      <thead>
        <tr className="text-[12px] font-bold text-muted-foreground">
          <th className="py-1 text-left">{title}</th>
          {["IP", "H", "ER", "BB", "K", "PIT"].map((h) => (
            <th key={h} className="w-10 text-center">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border/40">
            <td className="py-2 font-semibold text-foreground">{r.name}</td>
            <td className="text-center">{r.ip}</td>
            <td className="text-center">{r.h}</td>
            <td className="text-center">{r.er}</td>
            <td className="text-center">{r.bb}</td>
            <td className="text-center font-bold text-foreground">{r.k}</td>
            <td className="text-center">{r.pitches}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PanelHeader = ({ g }: { g: GameView }) => (
  <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
    <h2 className="whitespace-nowrap font-display text-[20px] font-bold uppercase leading-none tracking-wide text-foreground">Game Center</h2>
    {g.final ? (
      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-foreground">Final</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Updating live
      </span>
    )}
  </div>
);

/** Score, inning, bases, count, and the batter / pitcher boxes */
const ScoreBody = ({ g }: { g: GameView }) => {
  const inningText = g.final ? "Final" : `${g.isTop ? "Top" : "Bot"} ${g.inningLabel}`;
  return (
    <div className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[auto_1fr] md:items-center md:gap-x-8">
      <div className="flex flex-col gap-1.5">
        <TeamChipView abbr={g.away.abbr} id={g.away.id} runs={g.runs.away} dim={g.runs.away < g.runs.home} />
        <TeamChipView abbr={g.home.abbr} id={g.home.id} runs={g.runs.home} dim={g.runs.home < g.runs.away} />
      </div>

      <div className="flex items-center gap-4 text-foreground">
        <div className="text-center">
          <div className="font-display text-2xl font-bold uppercase leading-none">{inningText}</div>
        </div>
        {!g.final && (
          <>
            <Diamond bases={g.bases} />
            <div className="flex flex-col gap-1">
              <Dots label="Balls" count={g.balls} max={3} color="#34d399" />
              <Dots label="Strikes" count={g.strikes} max={2} color="#fbbf24" />
              <Dots label="Outs" count={g.outs} max={2} color="#f87171" />
            </div>
          </>
        )}
      </div>

      {!g.final && g.batter && (
        <div className="grid gap-4 rounded-xl bg-background/40 p-3 sm:grid-cols-2 md:col-span-2" style={{ borderLeft: `4px solid ${ACCENT}` }}>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>At bat</div>
            <div className="font-display text-2xl font-bold uppercase leading-tight text-foreground">
              {g.batter.name} <span className="text-base font-semibold text-muted-foreground">{g.batter.pos}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <Stat label="AVG" value={g.batter.avg} />
              <Stat label="HR" value={g.batter.hr} />
              <Stat label="RBI" value={g.batter.rbi} />
              <Stat label="Today" value={g.batter.today} />
            </div>
          </div>
          {g.pitcher && (
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Pitching</div>
              <div className="font-display text-2xl font-bold uppercase leading-tight text-foreground">{g.pitcher.name}</div>
              <div className="mt-2 grid grid-cols-4 gap-3">
                <Stat label="IP" value={g.pitcher.ip} />
                <Stat label="K" value={g.pitcher.k} />
                <Stat label="PIT" value={g.pitcher.pitches} />
                <Stat label="ERA" value={g.pitcher.era} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Live / Box / Pitching / Plays tabs. `compact` stacks the tables for a narrow side panel. */
const TabsBody = ({ g, compact = false }: { g: GameView; compact?: boolean }) => {
  const [tab, setTab] = useState<Tab>("Live");
  const mets = g.metsSide;
  const other = mets === "home" ? "away" : "home";
  const cols = compact ? "grid gap-5" : "grid gap-5 lg:grid-cols-2";
  return (
    <>
      <div role="tablist" aria-label="Game details" className="flex gap-1.5 px-3 pt-3 sm:px-4">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 flex-1 rounded-xl text-sm font-bold transition-colors",
              tab === t ? "text-white" : "bg-background/50 text-muted-foreground hover:text-foreground",
            )}
            style={tab === t ? { background: ACCENT } : undefined}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="px-4 pb-4 pt-3 sm:px-5">
        {tab === "Live" && (
          <div>
            <div className="mb-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">This at-bat</div>
            {g.final ? <p className="text-sm text-muted-foreground">That is a final. Check the Box and Plays tabs for the full game.</p> : <PitchList g={g} />}
          </div>
        )}
        {tab === "Box" && (
          <div className={cols}>
            <div>
              <div className="mb-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{g[mets].name} batting</div>
              <BoxTable rows={g.batting[mets]} />
            </div>
            <div>
              <div className="mb-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{g[other].name} batting</div>
              <BoxTable rows={g.batting[other]} />
            </div>
          </div>
        )}
        {tab === "Pitching" && (
          <div className={cols}>
            <PitchTable title={g[mets].name} rows={g.pitching[mets]} />
            <PitchTable title={g[other].name} rows={g.pitching[other]} />
          </div>
        )}
        {tab === "Plays" && (
          <ul className="space-y-2">
            {g.plays.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-background/40 p-3" style={p.scoring ? { borderLeft: `4px solid ${ACCENT}` } : undefined}>
                <span className="h-fit shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-display text-sm font-bold text-foreground">
                  {p.half.toLowerCase().startsWith("top") ? "Top" : "Bot"} {p.inning}
                </span>
                <span className="text-sm leading-snug text-foreground/90">{p.text}</span>
              </li>
            ))}
            {!g.plays.length && <li className="text-sm text-muted-foreground">Plays show up here as they happen.</li>}
          </ul>
        )}
      </div>
    </>
  );
};

const CARD = "overflow-hidden rounded-2xl border border-border/50 bg-card/80";

/** Score bar + line score, to sit under the video */
export const ScoreStrip = ({ g, className }: { g: GameView; className?: string }) => (
  <div role="region" aria-label="Score" className={cn(CARD, className)}>
    <ScoreBody g={g} />
    <div className="px-4 pb-3 sm:px-5">
      <LineScore g={g} />
    </div>
  </div>
);

/** The tabbed Game Center for a side column */
export const GameTabsPanel = ({ g, className }: { g: GameView; className?: string }) => (
  <div role="region" aria-label="Game Center" className={cn(CARD, className)}>
    <PanelHeader g={g} />
    <TabsBody g={g} compact />
  </div>
);

/** Everything in one card, for single-column pages */
const GameCenter = ({ g, className }: { g: GameView; className?: string }) => (
  <div role="region" aria-label="Game Center" className={cn(CARD, className)}>
    <PanelHeader g={g} />
    <ScoreBody g={g} />
    <div className="px-4 pb-3 sm:px-5">
      <LineScore g={g} />
    </div>
    <div className="border-t border-border/40">
      <TabsBody g={g} />
    </div>
  </div>
);

/* ---------- no game ---------- */

const useCountdown = (target?: Date) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const ms = Math.max(0, target.getTime() - now);
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor(ms / 3_600_000) % 24, mins: Math.floor(ms / 60_000) % 60 };
};

const fmtWhen = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " ET";

export const NoGameCard = ({ next, offseason, pregame, className }: { next: NextGame | null; offseason: boolean; pregame: boolean; className?: string }) => {
  const cd = useCountdown(next?.date);
  const kicker = pregame ? "First pitch soon" : offseason ? "Offseason" : "No game right now";
  const head = pregame
    ? "Game Center opens at first pitch"
    : offseason
      ? next?.spring
        ? "Spring Training is coming"
        : "The Mets are back soon"
      : `Next up: ${next?.home ? "vs" : "at"} ${next?.opponent ?? "TBD"}`;
  const links = [
    { to: "/replay-games", icon: Film, label: "Highlights" },
    { to: "/blog", icon: Newspaper, label: "Mets news" },
    { to: "/mets-schedule-2027", icon: CalendarDays, label: "Schedule" },
    ...(offseason ? [{ to: "/mets-shop", icon: ShoppingBag, label: "Mets Shop" }] : []),
  ];
  return (
    <div
      role="region"
      aria-label={offseason ? "Offseason" : "Next game"}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 sm:p-6",
        offseason ? "text-white" : "border-border/50 bg-card/80",
        className,
      )}
      style={offseason ? { background: "radial-gradient(80% 120% at 50% 130%, #7a3210 0%, #2a2a4a 42%, #08142c 100%)" } : undefined}
    >
      {offseason && (
        <div aria-hidden className="pointer-events-none absolute right-[-60px] top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 rotate-45 border-[3px] border-white/[0.07] sm:block" />
      )}
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 flex-1 basis-64">
          {offseason ? (
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#dfe7f3]">{kicker}</span>
          ) : (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>{kicker}</p>
          )}
          <h2 className={cn("mt-2 font-display text-[26px] font-bold uppercase leading-none tracking-wide sm:text-3xl", offseason ? "text-white" : "text-foreground")}>{head}</h2>
          <p className={cn("mt-2 text-[15px] leading-relaxed", offseason ? "text-[#c4cfdf]" : "text-muted-foreground")}>
            {offseason
              ? "Live games return in the spring. Until then, MetsXMFanZone has the news, the highlights and the show. The stream keeps going."
              : "Game Center and live stats appear here when a Mets game starts. The stream keeps going in the meantime."}
          </p>
          {next && (
            <p className={cn("mt-2 text-sm font-semibold", offseason ? "text-[#dfe7f3]" : "text-foreground")}>
              {`${offseason && next.spring ? "First game: " : ""}Mets ${next.home ? "vs" : "at"} ${next.opponent} · ${fmtWhen(next.date)}`}
            </p>
          )}
        </div>
        {cd && (
          <div className="flex gap-2" role="timer" aria-label={`${cd.days} days, ${cd.hours} hours, ${cd.mins} minutes to the next game`}>
            {[
              [cd.days, "Days"],
              [cd.hours, "Hrs"],
              [cd.mins, "Min"],
            ].map(([n, l]) => (
              <div key={l as string} className={cn("rounded-xl text-center", offseason ? "min-w-[68px] bg-white/[0.08] px-2 py-3" : "min-w-[60px] bg-background/50 px-2 py-2")}>
                <div className={cn("font-display font-bold leading-none tabular-nums", offseason ? "text-4xl text-white" : "text-3xl text-foreground")}>{String(n).padStart(2, "0")}</div>
                <div className={cn("mt-0.5 text-[11px] font-bold uppercase tracking-wide", offseason ? "text-[#b6c3d6]" : "text-muted-foreground")}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={cn("relative mt-4 grid gap-2 sm:grid-cols-3", offseason && "sm:grid-cols-4")}>
        {links.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors",
              offseason ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "border-border/60 bg-background/50 text-foreground hover:border-primary/50",
            )}
          >
            <Icon className="h-4 w-4" style={{ color: ACCENT }} /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
};

/* ---------- public component ---------- */

/**
 * Sits directly under a stream player (never over the video).
 * In a game it shows the Game Center; otherwise a short "next game" card.
 * `gameOnly` hides the no-game card for pages that already have their own.
 */
const LiveStatsSection = ({ className, gameOnly = false }: { className?: string; gameOnly?: boolean }) => {
  const { state, game, next } = useMetsLiveGame();
  if (state === "loading") return null;
  if ((state === "live" || state === "final") && game) return <GameCenter g={game} className={className} />;
  if (gameOnly) return null;
  return <NoGameCard next={next} offseason={state === "offseason"} pregame={state === "pregame"} className={className} />;
};

export default LiveStatsSection;
