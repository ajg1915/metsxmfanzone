import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/metsxmfanzone-logo.png";

// The website's Spring Training row for the TV: a days-to-the-first-game countdown card, then every
// Spring Training game. Always shown (the countdown keeps it from ever being empty). MLB's public schedule.

const METS = 121;
const SEASON = 2027;
const ET = "America/New_York";
const FALLBACK_OPENER = "2027-02-19T18:10:00Z";

const teamLogo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: ET, ...o }).format(new Date(iso));
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(d);

type Game = { id: number; date: string; isHome: boolean; opponent: string; oppId: number; timeTBD: boolean };

function useSpringGames() {
  return useQuery({
    queryKey: ["tv-spring-games", SEASON],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Game[]> => {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&season=${SEASON}&gameType=S&startDate=${SEASON}-02-01&endDate=${SEASON}-04-05&hydrate=team`,
      );
      if (!res.ok) throw new Error("schedule");
      const json = await res.json();
      const out: Game[] = [];
      for (const day of json.dates ?? []) {
        for (const g of day.games ?? []) {
          const isHome = g.teams.home.team.id === METS;
          const opp = (isHome ? g.teams.away : g.teams.home).team;
          out.push({ id: g.gamePk, date: g.gameDate, isHome, opponent: opp.name, oppId: opp.id, timeTBD: g.status?.startTimeTBD === true });
        }
      }
      return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    },
  });
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

/** Whole calendar days (New York time) from today to the date. */
function daysUntil(iso: string, now: number) {
  const [y1, m1, d1] = ymd(new Date(now)).split("-").map(Number);
  const [y2, m2, d2] = ymd(new Date(iso)).split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000));
}

const card = "shrink-0 w-[20vw] min-w-[260px] aspect-video rounded-[0.6rem] border border-white/10 overflow-hidden relative";

export function TVSpringTraining() {
  const navigate = useNavigate();
  const { data: games = [] } = useSpringGames();
  const now = useNow();
  const upcoming = games.filter((g) => +new Date(g.date) > now - 6 * 3_600_000);
  const first = games[0];
  const days = daysUntil(first?.date ?? FALLBACK_OPENER, now);

  return (
    <section id="tv-sec-spring" aria-label="Spring Training" className="relative mt-[2.4vh]">
      <div className="mb-[1vh] flex items-baseline gap-3 pl-[0.2vw]">
        <h2 className="text-[1.1rem] font-bold text-[color:var(--tv-text)]">Spring Training</h2>
        <span className="text-[0.85rem] text-[color:var(--tv-subtext)]">Grapefruit League · Port St. Lucie</span>
      </div>
      <div className="flex gap-[1vw] overflow-x-auto px-[0.6vw] py-[1.4vh] scrollbar-none">
        {/* Countdown */}
        <div className={`${card} flex flex-col justify-between p-[1.2vw] bg-[linear-gradient(135deg,#0b3e75_0%,#07111d_100%)]`}>
          <img src={logo} alt="" aria-hidden className="absolute -right-4 -top-4 h-[60%] w-auto object-contain opacity-15" />
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--tv-accent)]">Countdown</p>
          <div role="timer" aria-label={`${days} days until the first Spring Training game`}>
            <span className="text-[3.4rem] font-extrabold leading-none text-white">{days}</span>
            <span className="ml-2 text-[0.85rem] font-bold uppercase tracking-wider text-white/85">{days === 1 ? "day" : "days"} to the first game</span>
          </div>
          <div className="flex items-center gap-2 text-[0.85rem] font-semibold text-white">
            <img src={teamLogo(METS)} alt="" className="h-[1.6rem] w-[1.6rem] object-contain" />
            <span className="text-white/60">{first?.isHome === false ? "at" : "vs"}</span>
            <img src={teamLogo(first?.oppId ?? 146)} alt="" className="h-[1.6rem] w-[1.6rem] object-contain" />
            <span className="ml-1">{first ? fmt(first.date, { month: "short", day: "numeric" }) : "Feb 19"}</span>
          </div>
        </div>

        {upcoming.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => navigate("/spring-training-live")}
            onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })}
            className={`${card} flex flex-col justify-between p-[1.2vw] text-left bg-[linear-gradient(135deg,#0b3e75_0%,#07111d_100%)] focus:outline-none`}
          >
            <div className="flex items-center justify-between text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/70">
              <span>{fmt(g.date, { weekday: "short" })} · {fmt(g.date, { month: "short", day: "numeric" })}</span>
              <span>{g.timeTBD ? "Time TBA" : `${fmt(g.date, { hour: "numeric", minute: "2-digit" })} ET`}</span>
            </div>
            <div className="flex items-center justify-center gap-[1.6vw]">
              <img src={teamLogo(g.isHome ? METS : g.oppId)} alt="" className="h-[3.2rem] w-[3.2rem] object-contain" loading="lazy" />
              <span className="text-[0.85rem] font-bold text-white/60">VS</span>
              <img src={teamLogo(g.isHome ? g.oppId : METS)} alt="" className="h-[3.2rem] w-[3.2rem] object-contain" loading="lazy" />
            </div>
            <p className="truncate text-[0.85rem] font-bold uppercase tracking-wide text-white">{g.isHome ? "vs" : "at"} {g.opponent}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
