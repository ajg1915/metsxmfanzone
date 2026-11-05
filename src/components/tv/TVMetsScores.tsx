import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Mets score card for the TV: the latest game and the next one, plus Game Center, Gamecast and
// full-scores buttons. Reads MLB's public Stats API, refreshing faster while a game is on.

type Side = { id: number; name: string; score?: number };
type Game = { pk: number; date: string; state: "Preview" | "Live" | "Final"; detail: string; away: Side; home: Side };

const METS = 121;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const logo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;

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

async function load() {
  const today = new Date();
  const back = new Date(today.getTime() - 240 * 86400000);
  const fwd = new Date(today.getTime() + 300 * 86400000);
  const base = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&gameType=R,F,D,L,W`;
  const [a, b] = await Promise.all([
    fetch(`${base}&startDate=${iso(back)}&endDate=${iso(today)}`).then((r) => r.json()),
    fetch(`${base}&startDate=${iso(today)}&endDate=${iso(fwd)}`).then((r) => r.json()),
  ]);
  const flat = (x: any) => (x.dates || []).flatMap((d: any) => d.games || []).map(parse);
  const past = flat(a);
  const future = flat(b);
  const live = [...past, ...future].find((g) => g.state === "Live") || null;
  const last = [...past].reverse().find((g) => g.state === "Final") || null;
  const next = future.find((g) => g.state === "Preview") || null;
  return { live, last, next };
}

function Card({ label, game, accent }: { label: string; game: Game | null; accent?: boolean }) {
  if (!game) return null;
  const when = new Date(game.date).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const row = (s: Side) => (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <img src={logo(s.id)} alt="" className="h-[2rem] w-[2rem] shrink-0 object-contain" loading="lazy" />
        <span className={cn("truncate text-[1rem]", s.id === METS ? "font-bold text-white" : "text-[color:var(--tv-text)]")}>{s.name}</span>
      </span>
      {game.state !== "Preview" && <span className="text-[1.4rem] font-bold tabular-nums text-white">{s.score ?? 0}</span>}
    </div>
  );
  return (
    <div className="min-w-0 flex-1 rounded-[0.7rem] border border-white/10 bg-[color:var(--tv-card)] px-[1.4vw] py-[1.6vh]">
      <p className={cn("mb-[1vh] text-[0.8rem] font-bold uppercase tracking-wider", accent ? "text-[#fb7185]" : "text-[color:var(--tv-accent)]")}>{label}</p>
      <div className="space-y-[0.8vh]">{row(game.away)}{row(game.home)}</div>
      <p className="mt-[1vh] text-[0.85rem] text-[color:var(--tv-subtext)]">{game.state === "Preview" ? `${when} ET` : game.state === "Live" ? game.detail : `Final • ${when.split(",").slice(0, 2).join(",")}`}</p>
    </div>
  );
}

export function TVMetsScores() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const d = await load();
        if (stop) return;
        setData(d);
        setFailed(false);
        timer = window.setTimeout(tick, d.live ? 20_000 : 300_000);
      } catch {
        if (stop) return;
        setFailed(true);
        timer = window.setTimeout(tick, 60_000);
      }
    };
    void tick();
    return () => {
      stop = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const btn = "rounded-full bg-[color:var(--tv-surface)] px-[1.6vw] py-[1.1vh] text-[0.95rem] font-medium text-[color:var(--tv-text)]";

  return (
    <section id="tv-sec-scores" aria-label="Mets scores" className="mt-[2.4vh]">
      <div className="mb-[1vh] flex items-center gap-3 pl-[0.2vw]">
        <span aria-hidden="true" className="h-[1.2rem] w-[4px] rounded-full bg-[color:var(--tv-accent)]" />
        <h2 className="text-[1.35rem] font-bold text-[color:var(--tv-text)]">Mets Scores &amp; Game Center</h2>
      </div>
      <div className="flex flex-col gap-[1.2vh]">
        <div className="flex gap-[1.2vw]">
          {data?.live ? <Card label="Live now" game={data.live} accent /> : <Card label="Last game" game={data?.last ?? null} />}
          <Card label="Next game" game={data?.next ?? null} />
          {!data && <div className="flex-1 rounded-[0.7rem] border border-white/10 bg-[color:var(--tv-card)] px-[1.4vw] py-[2.4vh] text-[0.95rem] text-[color:var(--tv-subtext)]">{failed ? "Scores are not loading right now." : "Loading Mets scores…"}</div>}
          {data && !data.live && !data.last && !data.next && <div className="flex-1 rounded-[0.7rem] border border-white/10 bg-[color:var(--tv-card)] px-[1.4vw] py-[2.4vh] text-[0.95rem] text-[color:var(--tv-subtext)]">No Mets games on the schedule yet.</div>}
        </div>
        <div className="flex gap-[1vw]">
          <button type="button" className={btn} onClick={() => navigate("/game-center")}>Game Center</button>
          <button type="button" className={btn} onClick={() => navigate("/mets-gamecast")}>Gamecast</button>
          <button type="button" className={btn} onClick={() => navigate("/mets-scores")}>All scores</button>
        </div>
      </div>
    </section>
  );
}
