import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// "Live and upcoming games" row, Prime Video style: one tile per Mets game with both team logos,
// and a status chip (LIVE, final score, or the start time). Reads MLB's public Stats API.

type Side = { id: number; name: string; score?: number };
type Game = { pk: number; date: string; state: "Preview" | "Live" | "Final"; detail: string; away: Side; home: Side };

const METS = 121;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const logo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const nick = (n: string) => {
  const w = n.split(" ");
  return ["Red", "White", "Blue"].includes(w[w.length - 2]) ? w.slice(-2).join(" ") : w[w.length - 1];
};

function parse(g: any): Game {
  const s = g.status?.abstractGameState;
  return {
    pk: g.gamePk,
    date: g.gameDate,
    state: s === "Final" ? "Final" : s === "Live" ? "Live" : "Preview",
    detail: g.status?.detailedState || "",
    away: { id: g.teams.away.team.id, name: g.teams.away.team.name, score: g.teams.away.score },
    home: { id: g.teams.home.team.id, name: g.teams.home.team.name, score: g.teams.home.score },
  };
}

async function load(): Promise<Game[]> {
  const today = new Date();
  const back = new Date(today.getTime() - 240 * 86400000);
  const fwd = new Date(today.getTime() + 300 * 86400000);
  const base = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&gameType=R,F,D,L,W`;
  const [a, b] = await Promise.all([
    fetch(`${base}&startDate=${iso(back)}&endDate=${iso(today)}`).then((r) => r.json()),
    fetch(`${base}&startDate=${iso(today)}&endDate=${iso(fwd)}`).then((r) => r.json()),
  ]);
  const flat = (x: any) => (x.dates || []).flatMap((d: any) => d.games || []).map(parse);
  const past: Game[] = flat(a);
  const future: Game[] = flat(b);
  const live = [...past, ...future].filter((g) => g.state === "Live");
  const finals = past.filter((g) => g.state === "Final").slice(-3);
  const upcoming = future.filter((g) => g.state === "Preview").slice(0, 8);
  return [...live, ...upcoming, ...[...finals].reverse()];
}

export function TVGamesRail() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      let delay = 60_000;
      try {
        const g = await load();
        if (stop) return;
        setGames(g);
        delay = g.some((x) => x.state === "Live") ? 20_000 : 300_000;
      } catch {
        /* keep the last good list */
      }
      if (!stop) timer = window.setTimeout(tick, delay);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!games || games.length === 0) return null;

  return (
    <section id="tv-sec-scores" aria-label="Live and upcoming games" className="relative mt-[2.4vh]">
      <h2 className="mb-[1vh] pl-[0.2vw] text-[1.1rem] font-bold text-[color:var(--tv-text)]">Mets games</h2>
      <div className="flex gap-[1vw] overflow-x-auto px-[0.6vw] py-[1.4vh] scrollbar-none">
        {games.map((g) => {
          const when = new Date(g.date);
          const day = when.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
          const time = when.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
          const mets = g.home.id === METS ? g.home : g.away;
          const opp = g.home.id === METS ? g.away : g.home;
          const chip =
            g.state === "Live" ? "LIVE" : g.state === "Final" ? `FINAL ${g.away.score ?? 0}–${g.home.score ?? 0}` : `${time} ET`;
          return (
            <button
              key={g.pk}
              type="button"
              onClick={() => navigate("/mets-scores")}
              onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })}
              className="group shrink-0 w-[20vw] min-w-[260px] rounded-[0.6rem] text-left focus:outline-none"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-[0.6rem] border border-white/10 bg-[linear-gradient(135deg,#0b3e75_0%,#07111d_100%)]">
                <div className="absolute inset-0 flex items-center justify-center gap-[2.2vw]">
                  <img src={logo(g.away.id)} alt="" className="h-[40%] w-auto object-contain drop-shadow-lg" loading="lazy" />
                  <span className="text-[0.8rem] font-bold text-white/60">{g.home.id === METS ? "vs" : "@"}</span>
                  <img src={logo(g.home.id)} alt="" className="h-[40%] w-auto object-contain drop-shadow-lg" loading="lazy" />
                </div>
                <span
                  className={cn(
                    "absolute left-3 top-3 rounded px-2 py-0.5 text-[0.7rem] font-bold tracking-wider text-white",
                    g.state === "Live" ? "bg-[#e11d48]" : g.state === "Final" ? "bg-black/70" : "bg-[color:var(--tv-accent)]",
                  )}
                >
                  {chip}
                </span>
              </div>
              <p className="mt-[0.8vh] pl-[0.2vw] text-[0.85rem] font-medium leading-tight text-[color:var(--tv-text)] line-clamp-1">
                {g.home.id === METS ? `${nick(opp.name)} at ${nick(mets.name)}` : `${nick(mets.name)} at ${nick(opp.name)}`}
              </p>
              <p className="pl-[0.2vw] text-[0.75rem] leading-tight text-[color:var(--tv-subtext)] line-clamp-1">
                {g.state === "Live" ? g.detail : day}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
