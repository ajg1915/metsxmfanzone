import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

interface TickerGame {
  id: number;
  status: string;
  detailedState: string;
  isLive: boolean;
  isFinal: boolean;
  away: { name: string; abbr: string; score: number; logoId: number };
  home: { name: string; abbr: string; score: number; logoId: number };
  inning?: string;
  startTime?: string;
}

const ET = "America/New_York";
const todayET = () => {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
};

export function MLBScoresTicker() {
  const [games, setGames] = useState<TickerGame[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const date = todayET();
        const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const raw = json?.dates?.[0]?.games || [];
        const mapped: TickerGame[] = raw.map((g: any) => {
          const state: string = g.status?.abstractGameState || "";
          const detailed: string = g.status?.detailedState || "";
          const isLive = state === "Live";
          const isFinal = state === "Final";
          const ls = g.linescore;
          const inningState = ls?.inningState ? `${ls.inningState.slice(0, 3)} ` : "";
          const inning = ls?.currentInningOrdinal ? `${inningState}${ls.currentInningOrdinal}` : "";
          const startTime = g.gameDate
            ? new Date(g.gameDate).toLocaleTimeString("en-US", {
                timeZone: ET,
                hour: "numeric",
                minute: "2-digit",
              })
            : "";
          return {
            id: g.gamePk,
            status: state,
            detailedState: detailed,
            isLive,
            isFinal,
            inning,
            startTime,
            away: {
              name: g.teams?.away?.team?.name || "",
              abbr: g.teams?.away?.team?.abbreviation || "",
              score: g.teams?.away?.score ?? 0,
              logoId: g.teams?.away?.team?.id,
            },
            home: {
              name: g.teams?.home?.team?.name || "",
              abbr: g.teams?.home?.team?.abbreviation || "",
              score: g.teams?.home?.score ?? 0,
              logoId: g.teams?.home?.team?.id,
            },
          };
        });
        if (!cancelled) setGames(mapped);
      } catch (e) {
        console.error("[MLBScoresTicker] fetch failed:", e);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (games.length === 0) return null;

  // Duplicate for seamless marquee loop
  const loop = [...games, ...games];

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-r from-black via-primary/20 to-black border-y border-primary/40 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-white/20">
          <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-[10px] font-black tracking-wider text-white uppercase">
            MLB Live
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-6 animate-marquee-left whitespace-nowrap">
            {loop.map((g, i) => (
              <div key={`${g.id}-${i}`} className="flex items-center gap-2 shrink-0">
                <img
                  src={`https://www.mlbstatic.com/team-logos/${g.away.logoId}.svg`}
                  alt={g.away.abbr}
                  className="w-4 h-4 object-contain"
                  loading="lazy"
                />
                <span className="text-[11px] font-bold text-white">{g.away.abbr}</span>
                <span
                  className={`text-[11px] font-black ${
                    g.away.score > g.home.score ? "text-primary" : "text-white/80"
                  }`}
                >
                  {g.away.score}
                </span>
                <span className="text-[10px] text-white/50">@</span>
                <img
                  src={`https://www.mlbstatic.com/team-logos/${g.home.logoId}.svg`}
                  alt={g.home.abbr}
                  className="w-4 h-4 object-contain"
                  loading="lazy"
                />
                <span className="text-[11px] font-bold text-white">{g.home.abbr}</span>
                <span
                  className={`text-[11px] font-black ${
                    g.home.score > g.away.score ? "text-primary" : "text-white/80"
                  }`}
                >
                  {g.home.score}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    g.isLive
                      ? "bg-red-600 text-white animate-pulse"
                      : g.isFinal
                      ? "bg-white/15 text-white/80"
                      : "bg-primary/30 text-primary-foreground"
                  }`}
                >
                  {g.isLive ? g.inning || "LIVE" : g.isFinal ? "FINAL" : g.startTime}
                </span>
                <span className="text-white/20 pl-2">•</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MLBScoresTicker;
